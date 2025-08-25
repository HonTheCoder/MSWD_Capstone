// 🎨 Generate a consistent color from a string (resident/barangay name)
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
}

// ===== CSV Export Utility =====
function exportToCSV(data, filename) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => headers.map(h => (obj[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===== Custom Legend Generator (interactive) =====
function generateInteractiveLegend(chart, legendId, toggleFn) {
  const legendDiv = document.getElementById(legendId);
  if (!legendDiv) return;

  legendDiv.innerHTML = chart.data.labels.map((label, i) => {
    const meta = chart.getDatasetMeta(0);
    const hidden = meta.data[i].hidden;
    const color = chart.data.datasets[0].backgroundColor[i];
    return `
      <div onclick="${toggleFn}(${i})"
           style="display:flex;align-items:center;margin:4px 0;cursor:pointer;opacity:${hidden ? 0.4 : 1};">
        <span style="background:${color};width:14px;height:14px;display:inline-block;margin-right:8px;border-radius:3px;"></span>
        <span>${label}</span>
      </div>
    `;
  }).join('');
}

// ===== MSWD: Barangay Priority Chart =====
async function loadBarangayPriorityChart(db, getDocs, collection) {
  const residentsRef = collection(db, "residents");
  const snap = await getDocs(residentsRef);

  const agg = {};
  snap.forEach(d => {
    const r = d.data();
    const b = r.barangay || 'Unknown';
    if (!agg[b]) agg[b] = { evac: 0, income: 0, relief: 0, count: 0 };
    agg[b].evac += Number(r.evacueeHistory) || 0;
    agg[b].income += Number(r.monthlyIncome) || 0;
    agg[b].relief += Number(r.aidHistory) || 0;
    agg[b].count += 1;
  });

  const rows = Object.entries(agg).map(([barangay, v]) => {
    const avgIncome = v.count ? v.income / v.count : 1;
    const score = v.evac / ((avgIncome / 1000) * (1 + v.relief * 0.5));
    return {
      barangay,
      evac: v.evac,
      score: Number(score.toFixed(2))
    };
  }).sort((a,b) => b.score - a.score);

  const labels = rows.map(r => r.barangay);
  const scores = rows.map(r => r.score);
  const total = scores.reduce((a,b) => a+b, 0);
  const percentages = scores.map(s => total > 0 ? (s/total*100).toFixed(1) : 0);
  const colors = labels.map(name => stringToColor(name));

  const ctx = document.getElementById('barangayPriorityChart').getContext('2d');
  if (window._barangayChart) window._barangayChart.destroy();
  window._barangayChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: percentages, backgroundColor: colors }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ": " + context.raw + "%";
            }
          }
        },
        datalabels: {
          formatter: (value) => value + "%",
          color: "#000",
          font: { weight: "bold" }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  generateInteractiveLegend(window._barangayChart, 'barangayLegend', 'toggleBarangay');

  // ✅ Hook export button AFTER rows & total are ready
  const exportBtn = document.getElementById("exportBarangayCSVBtn");
  if (exportBtn) {
    exportBtn.onclick = () => {
      const exportData = rows.map(r => {
        const percent = total > 0 ? ((r.score / total) * 100).toFixed(1) + "%" : "0%";
        return {
          Barangay: r.barangay,
          Evacuations: r.evac,
          Percent: percent
        };
      });
      exportToCSV(exportData, "barangay_priority.csv");
    };
  }

  // ✅ Top lists
  document.getElementById('topBarangaysList').innerHTML = `
    <div class="priority-lists">
      <div class="priority-list">
        <h3>Top 3 Urgent Barangays</h3>
        <ol>
          ${rows.slice(0,3).map(r => {
            const percent = total > 0 ? ((r.score / total) * 100).toFixed(1) + "%" : "0%";
            return `<li>${r.barangay} — Percent: ${percent}</li>`;
          }).join('')}
        </ol>
      </div>
      <div class="priority-list">
        <h3>🚨 Barangay with Most Evacuees</h3>
        ${(() => {
          const mostEvac = [...rows].sort((a,b) => b.evac - a.evac)[0];
          return mostEvac ? `<p>${mostEvac.barangay} — ${mostEvac.evac} evacuees</p>` : '';
        })()}
      </div>
    </div>`;
}

// ===== Barangay: Resident Priority Chart =====
async function loadResidentPriorityChart(db, getDocs, collection, query, where, barangayName) {
  const residentsRef = collection(db, "residents");
  const qRes = query(residentsRef, where("barangay", "==", barangayName));
  const snap = await getDocs(qRes);

  const rows = [];
  snap.forEach(d => {
    const r = d.data();
    const income = r.monthlyIncome ? Number(r.monthlyIncome) : 1;
    const relief = r.aidHistory ? Number(r.aidHistory) : 0;
    const evac = r.evacueeHistory ? Number(r.evacueeHistory) : 0;
    const score = (evac * 2) / ((income / 1000) * (1 + relief * 0.5));
    rows.push({
      name: r.name || '(Unnamed)',
      evac,
      score: Number(score.toFixed(2))
    });
  });
  rows.sort((a,b) => b.score - a.score);

  const labels = rows.map(r => r.name);
  const scores = rows.map(r => r.score);
  const total = scores.reduce((a,b) => a+b, 0);
  const percentages = scores.map(s => total > 0 ? (s/total*100).toFixed(1) : 0);
  const colors = labels.map(name => stringToColor(name));

  const ctx = document.getElementById('residentPriorityChart').getContext('2d');
  if (window._residentChart) window._residentChart.destroy();
  window._residentChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: percentages, backgroundColor: colors }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ": " + context.raw + "%";
            }
          }
        },
        datalabels: {
          formatter: (value) => value + "%",
          color: "#000",
          font: { weight: "bold" }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  generateInteractiveLegend(window._residentChart, 'residentLegend', 'toggleResident');

  // ✅ Lists
  document.getElementById('topResidentsList').innerHTML = `
    <h3>Top 5 Priority Residents</h3>
    <ol>
      ${rows.slice(0,5).map(r => {
        const percent = total > 0 ? ((r.score / total) * 100).toFixed(1) + "%" : "0%";
        return `<li>${r.name} — Percent: ${percent}</li>`;
      }).join('')}
    </ol>`;
  document.getElementById('topEvacueesList').innerHTML = `
    <h3>🚨 Top 5 Most Evacuees</h3>
    <ol>
      ${[...rows].sort((a,b) => b.evac - a.evac).slice(0,5).map(r =>
        `<li>${r.name} — Evacuations: ${r.evac}</li>`).join('')}
    </ol>`;
}

// ===== Toggle Functions =====
function toggleResident(index) {
  const ci = window._residentChart;
  const meta = ci.getDatasetMeta(0);
  meta.data[index].hidden = !meta.data[index].hidden;
  ci.update();
  generateInteractiveLegend(ci, 'residentLegend', 'toggleResident');
}

function toggleBarangay(index) {
  const ci = window._barangayChart;
  const meta = ci.getDatasetMeta(0);
  meta.data[index].hidden = !meta.data[index].hidden;
  ci.update();
  generateInteractiveLegend(ci, 'barangayLegend', 'toggleBarangay');
}

// Expose globally
window.loadBarangayPriorityChart = loadBarangayPriorityChart;
window.loadResidentPriorityChart = loadResidentPriorityChart;
