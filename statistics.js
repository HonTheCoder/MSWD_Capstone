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

    // Build table from list data
    const rows = listContainer.querySelectorAll('li');
    let tableHtml = '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>';
    rows.forEach(li => {
      const name = li.querySelector('.pl-name')?.textContent || '';
      const value = li.querySelector('.pl-value')?.textContent || '';
      tableHtml += `<tr><td>${name}</td><td>${value}</td></tr>`;
    });
    tableHtml += '</tbody></table>';

    // Get chart as image
    const dataUrl = chartCanvas.toDataURL('image/png');
    
    // Build content using standardized template
    const bodyHTML = `
      <div class="section">
        <div style="text-align:center; margin-bottom:16px;">
          <img src="${dataUrl}" style="max-width:100%; height:auto; border:1px solid #e5e7eb; border-radius:4px;" alt="Chart"/>
        </div>
      </div>
      <div class="section">
        <div class="small" style="font-weight:700;margin-bottom:6px;">${title} Data</div>
        ${tableHtml}
      </div>
    `;

    // Use the buildA4PrintHTML function from app.js if available
    if (typeof window.buildA4PrintHTML === 'function' && typeof window.openPrintA4 === 'function') {
      const pageHTML = window.buildA4PrintHTML({
        title: title || 'STATISTICS REPORT',
        subtitle: 'Municipal Social Welfare and Development Office',
        bodyHTML: bodyHTML,
        footerHTML: `<div class="small">This is an official statistics report. Generated on ${new Date().toLocaleString()}.</div>`
      });
      window.openPrintA4(pageHTML);
    } else {
      // Fallback to original method if buildA4PrintHTML is not available
      const win = window.open('', '_blank');
      const style = `<style>@page{size:A4;margin:12mm;}body{font-family:Arial,sans-serif;color:#111;}.chart-wrap{display:flex;justify-content:center;margin:16px 0;}table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:12px;}th{background:#f5f5f5;}</style>`;
      const html = `<h1 style="text-align:center;">${title}</h1><div class="chart-wrap"><img src="${dataUrl}" style="max-width:700px;width:100%;"/></div>${tableHtml}`;
      win.document.write(`<html><head><title>${title}</title>${style}</head><body>${html}</body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 200);
    }
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
