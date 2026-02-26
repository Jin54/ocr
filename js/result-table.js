/* result-table.js - Editable results table: 파일이름 - 데이터 */

const ResultTable = (function () {
  let columns = ['파일', '데이터'];
  let rows = [];

  const section = () => document.getElementById('results-section');
  const thead = () => document.querySelector('#results-table thead');
  const tbody = () => document.querySelector('#results-table tbody');

  function addResults(fileName, ocrResults) {
    // 모든 영역의 텍스트를 하나로 합침
    const text = ocrResults.map(r => r.text).filter(t => t && t !== '[인식 실패]').join(' | ');

    rows.push({ '파일': fileName, '데이터': text });
    render();
    section().classList.remove('hidden');
  }

  function render() {
    // Header
    const headerHtml = columns.map(c => `<th>${escapeHtml(c)}</th>`).join('') + '<th></th>';
    thead().innerHTML = `<tr>${headerHtml}</tr>`;

    // Body
    const bodyHtml = rows.map((row, ri) => {
      const cells = columns.map(c =>
        `<td contenteditable="true" data-row="${ri}" data-col="${escapeAttr(c)}">${escapeHtml(row[c] || '')}</td>`
      ).join('');
      return `<tr>${cells}<td class="row-delete" data-row="${ri}">&times;</td></tr>`;
    }).join('');
    tbody().innerHTML = bodyHtml;

    // Bind edit events
    tbody().querySelectorAll('td[contenteditable]').forEach(td => {
      td.addEventListener('blur', onCellEdit);
    });

    // Bind delete events
    tbody().querySelectorAll('.row-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ri = parseInt(e.target.dataset.row);
        rows.splice(ri, 1);
        if (rows.length === 0) {
          section().classList.add('hidden');
        }
        render();
      });
    });
  }

  function onCellEdit(e) {
    const ri = parseInt(e.target.dataset.row);
    const col = e.target.dataset.col;
    rows[ri][col] = e.target.textContent;
  }

  function clear() {
    rows = [];
    render();
    section().classList.add('hidden');
  }

  function getData() {
    return { columns, rows };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { addResults, clear, getData, render };
})();
