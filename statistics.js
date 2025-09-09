// statistics.js
(function(){
  function bindStatsButtons(excelBtn, pdfBtn, printBtn, scope) {
    const chartCanvasId = scope === 'barangay' ? 'barangayPriorityChart' : 'residentPriorityChart';
    const listId = scope === 'barangay' ? 'topBarangaysList' : 'topResidentsList';

    if (excelBtn) {
      excelBtn.onclick = () => exportStatsTableToExcel(listId, scope === 'barangay' ? 'Barangay Priority' : 'Resident Priority');
    }
    if (pdfBtn) {
      pdfBtn.onclick = () => exportStatsToPDF(chartCanvasId, listId, scope === 'barangay' ? 'Barangay Priority' : 'Resident Priority');
    }
    if (printBtn) {
      printBtn.onclick = () => printStats(chartCanvasId, listId, scope === 'barangay' ? 'Barangay Priority' : 'Resident Priority');
    }
  }

  function exportStatsTableToExcel(listContainerId, title) {
    const container = document.getElementById(listContainerId);
    if (!container) return;
    const tempTable = document.createElement('table');
    const rows = container.querySelectorAll('li');
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>${title}</th><th>Value</th></tr>`;
    tempTable.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach(li => {
      const name = li.querySelector('.pl-name')?.textContent || '';
      const value = li.querySelector('.pl-value')?.textContent || '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${name}</td><td>${value}</td>`;
      tbody.appendChild(tr);
    });
    tempTable.appendChild(tbody);

    if (window.jQuery) {
      const $ = window.jQuery;
      $(tempTable).DataTable({
        dom: 'Bfrtip',
        buttons: [ { extend: 'excelHtml5', title } ],
        destroy: true
      });
      $(tempTable).DataTable().button('.buttons-excel').trigger();
      $(tempTable).DataTable().destroy();
    }
  }

  function exportStatsToPDF(chartCanvasId, listContainerId, title) {
    printStats(chartCanvasId, listContainerId, title, true);
  }

  function printStats(chartCanvasId, listContainerId, title, pdf = false) {
    const chartCanvas = document.getElementById(chartCanvasId);
    const listContainer = document.getElementById(listContainerId);
    if (!chartCanvas || !listContainer) return;

    const win = window.open('', '_blank');
    const style = `
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color:#111; }
        h1 { font-size: 18px; margin: 0 0 8px; text-align:center; }
        .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .chart-wrap { display:flex; justify-content:center; }
        .list-wrap table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
        th { background:#f5f5f5; }
        @page { margin: 12mm; size: A4 landscape; }
        @media print { .controls { display:none } }
      </style>`;

    const rows = listContainer.querySelectorAll('li');
    let tableHtml = '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>';
    rows.forEach(li => {
      const name = li.querySelector('.pl-name')?.textContent || '';
      const value = li.querySelector('.pl-value')?.textContent || '';
      tableHtml += `<tr><td>${name}</td><td>${value}</td></tr>`;
    });
    tableHtml += '</tbody></table>';

    const dataUrl = chartCanvas.toDataURL('image/png');
    const html = `
      <h1>${title}</h1>
      <div class="grid">
        <div class="chart-wrap"><img src="${dataUrl}" style="max-width:700px;width:100%;"/></div>
        <div class="list-wrap">${tableHtml}</div>
      </div>`;

    win.document.write(`<html><head><title>${title}</title>${style}</head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 200);
  }

  window.setupStatsExports = function(type) {
    try {
      if (type === 'barangay') {
        const excelBtn = document.getElementById('exportBarangayExcelBtn');
        const pdfBtn = document.getElementById('exportBarangayPDFBtn');
        const printBtn = document.getElementById('printBarangayStatsBtn');
        bindStatsButtons(excelBtn, pdfBtn, printBtn, 'barangay');
      } else {
        const excelBtn = document.getElementById('exportResidentExcelBtn');
        const pdfBtn = document.getElementById('exportResidentPDFBtn');
        const printBtn = document.getElementById('printResidentStatsBtn');
        bindStatsButtons(excelBtn, pdfBtn, printBtn, 'resident');
      }
    } catch(_) {}
  }
})();
