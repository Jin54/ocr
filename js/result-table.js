/* result-table.js - 파일 | 스킬1 | 레벨1 | 스킬2 | 레벨2 ... */

const ResultTable = (function () {
  let maxSkills = 0;
  let rows = []; // { fileName, skills: [{name, level}, ...] }

  const section = () => document.getElementById('results-section');
  const thead = () => document.querySelector('#results-table thead');
  const tbody = () => document.querySelector('#results-table tbody');

  function addResults(fileName, skills) {
    if (skills.length > maxSkills) {
      maxSkills = skills.length;
    }
    rows.push({ fileName, skills });
    render();
    section().classList.remove('hidden');
  }

  function getColumns() {
    const cols = ['파일'];
    for (let i = 0; i < maxSkills; i++) {
      cols.push('스킬' + (i + 1));
      cols.push('레벨' + (i + 1));
    }
    return cols;
  }

  function render() {
    const cols = getColumns();

    // Header
    const headerHtml = cols.map(c => `<th>${c}</th>`).join('') + '<th></th>';
    thead().innerHTML = `<tr>${headerHtml}</tr>`;

    // Body
    const bodyHtml = rows.map((row, ri) => {
      let cells = `<td contenteditable="true" data-row="${ri}" data-col="fileName">${escapeHtml(row.fileName)}</td>`;
      for (let i = 0; i < maxSkills; i++) {
        const skill = row.skills[i];
        cells += `<td contenteditable="true" data-row="${ri}" data-col="name_${i}">${escapeHtml(skill ? skill.name : '')}</td>`;
        cells += `<td contenteditable="true" data-row="${ri}" data-col="level_${i}">${escapeHtml(skill ? skill.level : '')}</td>`;
      }
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
        // maxSkills 재계산
        maxSkills = rows.reduce((max, r) => Math.max(max, r.skills.length), 0);
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
    const value = e.target.textContent;

    if (col === 'fileName') {
      rows[ri].fileName = value;
    } else if (col.startsWith('name_')) {
      const idx = parseInt(col.split('_')[1]);
      if (!rows[ri].skills[idx]) rows[ri].skills[idx] = { name: '', level: '' };
      rows[ri].skills[idx].name = value;
    } else if (col.startsWith('level_')) {
      const idx = parseInt(col.split('_')[1]);
      if (!rows[ri].skills[idx]) rows[ri].skills[idx] = { name: '', level: '' };
      rows[ri].skills[idx].level = value;
    }
  }

  function clear() {
    rows = [];
    maxSkills = 0;
    render();
    section().classList.add('hidden');
  }

  function getData() {
    const cols = getColumns();
    const exportRows = rows.map(row => {
      const obj = { '파일': row.fileName };
      for (let i = 0; i < maxSkills; i++) {
        const skill = row.skills[i];
        obj['스킬' + (i + 1)] = skill ? skill.name : '';
        obj['레벨' + (i + 1)] = skill ? skill.level : '';
      }
      return obj;
    });
    return { columns: cols, rows: exportRows };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { addResults, clear, getData, render };
})();
