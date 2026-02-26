/* template-manager.js - Region template save/load via localStorage */

const TemplateManager = (function () {
  const STORAGE_KEY = 'ocr_templates';

  function init() {
    document.getElementById('btn-save-template').addEventListener('click', saveTemplate);
    document.getElementById('btn-load-template').addEventListener('click', loadTemplate);
    document.getElementById('btn-delete-template').addEventListener('click', deleteTemplate);
    document.getElementById('btn-export-template').addEventListener('click', exportTemplate);
    document.getElementById('btn-import-template').addEventListener('click', () => {
      document.getElementById('template-file-input').click();
    });
    document.getElementById('template-file-input').addEventListener('change', importTemplate);

    refreshSelect();
  }

  function getTemplates() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  function setTemplates(templates) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (err) {
      App.toast('저장 공간이 부족합니다. 기존 템플릿을 삭제해주세요.', 'error');
    }
  }

  function refreshSelect() {
    const select = document.getElementById('template-select');
    const templates = getTemplates();
    const names = Object.keys(templates);

    select.innerHTML = '<option value="">-- 템플릿 선택 --</option>';
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  function saveTemplate() {
    const regions = RegionSelector.getRegions();
    if (regions.length === 0) {
      App.toast('저장할 영역이 없습니다', 'error');
      return;
    }

    const name = prompt('템플릿 이름을 입력하세요:');
    if (!name || !name.trim()) return;

    const templates = getTemplates();

    if (templates[name.trim()] && !confirm('같은 이름의 템플릿이 있습니다. 덮어쓸까요?')) {
      return;
    }

    templates[name.trim()] = {
      createdAt: new Date().toISOString(),
      regions: regions.map(r => ({
        id: r.id,
        label: r.label,
        nx: r.nx,
        ny: r.ny,
        nw: r.nw,
        nh: r.nh,
        psm: r.psm,
      })),
    };

    setTemplates(templates);
    refreshSelect();

    // Select the saved template
    document.getElementById('template-select').value = name.trim();
    App.toast('템플릿 "' + name.trim() + '" 저장 완료', 'success');
  }

  function loadTemplate() {
    const name = document.getElementById('template-select').value;
    if (!name) {
      App.toast('템플릿을 선택해주세요', 'error');
      return;
    }

    const templates = getTemplates();
    const template = templates[name];
    if (!template) {
      App.toast('템플릿을 찾을 수 없습니다', 'error');
      return;
    }

    RegionSelector.setRegions(template.regions);
    App.toast('템플릿 "' + name + '" 불러오기 완료', 'success');
  }

  function deleteTemplate() {
    const name = document.getElementById('template-select').value;
    if (!name) {
      App.toast('삭제할 템플릿을 선택해주세요', 'error');
      return;
    }

    if (!confirm('템플릿 "' + name + '"을(를) 삭제할까요?')) return;

    const templates = getTemplates();
    delete templates[name];
    setTemplates(templates);
    refreshSelect();
    App.toast('템플릿 삭제 완료', 'success');
  }

  function exportTemplate() {
    const templates = getTemplates();
    if (Object.keys(templates).length === 0) {
      App.toast('내보낼 템플릿이 없습니다', 'error');
      return;
    }

    const json = JSON.stringify(templates, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr_templates.json';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('템플릿 내보내기 완료', 'success');
  }

  function importTemplate(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        const templates = getTemplates();
        let count = 0;

        for (const [name, data] of Object.entries(imported)) {
          if (data.regions && Array.isArray(data.regions)) {
            templates[name] = data;
            count++;
          }
        }

        setTemplates(templates);
        refreshSelect();
        App.toast(count + '개 템플릿 가져오기 완료', 'success');
      } catch (err) {
        App.toast('잘못된 템플릿 파일입니다', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return { init, refreshSelect };
})();
