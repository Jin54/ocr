/* export-manager.js - CSV, Excel (SheetJS), JSON export */

const ExportManager = (function () {
  function init() {
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export-excel').addEventListener('click', exportExcel);
    document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  }

  function exportCSV() {
    const { columns, rows } = ResultTable.getData();
    if (rows.length === 0) {
      App.toast('내보낼 데이터가 없습니다', 'error');
      return;
    }

    const csvLines = [
      columns.map(c => '"' + c.replace(/"/g, '""') + '"').join(','),
      ...rows.map(row =>
        columns.map(c => '"' + (row[c] || '').replace(/"/g, '""') + '"').join(',')
      ),
    ];

    const csvContent = csvLines.join('\n');
    // BOM for Korean in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    download(blob, 'ocr_results.csv');
    App.toast('CSV 파일 다운로드 완료', 'success');
  }

  function exportExcel() {
    const { columns, rows } = ResultTable.getData();
    if (rows.length === 0) {
      App.toast('내보낼 데이터가 없습니다', 'error');
      return;
    }

    try {
      const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'OCR Results');
      XLSX.writeFile(wb, 'ocr_results.xlsx');
      App.toast('Excel 파일 다운로드 완료', 'success');
    } catch (err) {
      console.error('Excel export error:', err);
      App.toast('Excel 내보내기 실패', 'error');
    }
  }

  async function exportJSON() {
    const { columns, rows } = ResultTable.getData();
    if (rows.length === 0) {
      App.toast('내보낼 데이터가 없습니다', 'error');
      return;
    }

    const json = JSON.stringify(rows, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      App.toast('JSON이 클립보드에 복사되었습니다', 'success');
    } catch (err) {
      // fallback: 다운로드
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      download(blob, 'ocr_results.json');
      App.toast('클립보드 실패, JSON 파일 다운로드', 'success');
    }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { init };
})();
