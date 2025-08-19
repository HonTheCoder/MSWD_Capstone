// ===== Utility: Random Color Generator =====
function getRandomColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        colors.push(`rgba(${r}, ${g}, ${b}, 0.8)`);
    }
    return colors;
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

// ===== MSWD: Barangay Priority Chart =====
async function loadBarangayPriorityChart(db, getDocs, collection) {
    const residentsRef = collection(db, "residents");
    const snap = await getDocs(residentsRef);

    const agg = {};
    snap.forEach(d => {
        const r = d.data();
        const b = r.barangay || 'Unknown';
        if (!agg[b]) agg[b] = { evac: 0, income: 0, count: 0 };
        agg[b].evac += Number(r.evacueeHistory) || 0;
        agg[b].income += Number(r.monthlyIncome) || 0;
        agg[b].count += 1;
    });

    const rows = Object.entries(agg).map(([barangay, v]) => {
        const avgIncome = v.count ? v.income / v.count : 1;
        const score = v.evac / ((avgIncome || 1) / 1000);
        return { barangay, score: Number(score.toFixed(2)) };
    }).sort((a,b) => b.score - a.score);

    const labels = rows.map(r => r.barangay);
    const data = rows.map(r => r.score);
    const colors = getRandomColors(data.length);
    const total = data.reduce((a,b) => a+b, 0);

    const ctx = document.getElementById('barangayPriorityChart').getContext('2d');
    if (window._barangayChart) { window._barangayChart.destroy(); }
    window._barangayChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataset = context.dataset;
                            const total = dataset.data.reduce((a,b) => a+b, 0);
                            const value = dataset.data[context.dataIndex];
                            const percent = ((value / total) * 100).toFixed(1) + "%";
                            return context.label + ": " + percent;
                        }
                    }
                },
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 20,
                        padding: 15,
                        generateLabels: (chart) => {
                            const data = chart.data.datasets[0].data;
                            const total = data.reduce((a, b) => a + b, 0);
                            return chart.data.labels.map((label, i) => {
                                const value = data[i];
                                const percentage = ((value / total) * 100).toFixed(1) + "%";
                                const meta = chart.getDatasetMeta(0);
                                const hidden = meta.data[i].hidden === true;
                                return {
                                    text: label + " (" + percentage + ")",
                                    fillStyle: chart.data.datasets[0].backgroundColor[i],
                                    strokeStyle: chart.data.datasets[0].backgroundColor[i],
                                    hidden,
                                    index: i
                                };
                            });
                        }
                    }
                },
                datalabels: { display: false }
            }
        },
        plugins: [ChartDataLabels]
    });

    document.getElementById('topBarangaysList').innerHTML = '<h3>Top 3 Urgent Barangays</h3><ol>' +
        rows.slice(0,3).map(r => {
            const percent = ((r.score / total) * 100).toFixed(1) + "%";
            return `<li>${r.barangay} — Percent: ${percent}</li>`;
        }).join('') +
        '</ol>';

    document.getElementById('exportBarangayCSVBtn').onclick = () => exportToCSV(rows, 'barangay_priority.csv');
}

// ===== Barangay: Resident Priority Chart =====
async function loadResidentPriorityChart(db, getDocs, collection, query, where, barangayName) {
    const residentsRef = collection(db, "residents");
    const qRes = query(residentsRef, where("barangay", "==", barangayName));
    const snap = await getDocs(qRes);

    const rows = [];
    snap.forEach(d => {
        const r = d.data();
        const income = Number(r.monthlyIncome) || 1;
        const evac = Number(r.evacueeHistory) || 0;
        const score = evac / (income / 1000);
        rows.push({ name: r.name || '(Unnamed)', score: Number(score.toFixed(2)) });
    });
    rows.sort((a,b) => b.score - a.score);

    const labels = rows.map(r => r.name);
    const data = rows.map(r => r.score);
    const colors = getRandomColors(data.length);
    const total = data.reduce((a,b) => a+b, 0);

    const ctx = document.getElementById('residentPriorityChart').getContext('2d');
    if (window._residentChart) { window._residentChart.destroy(); }
    window._residentChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataset = context.dataset;
                            const total = dataset.data.reduce((a,b) => a+b, 0);
                            const value = dataset.data[context.dataIndex];
                            const percent = ((value / total) * 100).toFixed(1) + "%";
                            return context.label + ": " + percent;
                        }
                    }
                },
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 20,
                        padding: 15,
                        generateLabels: (chart) => {
                            const data = chart.data.datasets[0].data;
                            const total = data.reduce((a, b) => a + b, 0);
                            return chart.data.labels.map((label, i) => {
                                const value = data[i];
                                const percentage = ((value / total) * 100).toFixed(1) + "%";
                                const meta = chart.getDatasetMeta(0);
                                const hidden = meta.data[i].hidden === true;
                                return {
                                    text: label + " (" + percentage + ")",
                                    fillStyle: chart.data.datasets[0].backgroundColor[i],
                                    strokeStyle: chart.data.datasets[0].backgroundColor[i],
                                    hidden,
                                    index: i
                                };
                            });
                        }
                    }
                },
                datalabels: { display: false }
            }
        },
        plugins: [ChartDataLabels]
    });

    document.getElementById('topResidentsList').innerHTML = '<h3>Top 5 Priority Residents</h3><ol>' +
        rows.slice(0,5).map(r => {
            const percent = total > 0 ? ((r.score / total) * 100).toFixed(1) + "%" : "0%";
            return `<li>${r.name} — Percent: ${percent}</li>`;
        }).join('') +
        '</ol>';

    document.getElementById('exportResidentCSVBtn').onclick = () => exportToCSV(rows, 'resident_priority.csv');
}

// Expose globally
window.loadBarangayPriorityChart = loadBarangayPriorityChart;
window.loadResidentPriorityChart = loadResidentPriorityChart;
