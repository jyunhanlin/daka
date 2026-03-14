const invoke = window.__TAURI__.core.invoke;

// DOM references
const moduleSelect = document.getElementById("module");
const maxRetriesInput = document.getElementById("max_retries");
const punchInInput = document.getElementById("punch_in");
const punchOutInput = document.getElementById("punch_out");
const delayStartInput = document.getElementById("delay_start_mins");
const delayEndInput = document.getElementById("delay_end_mins");
const lateToleranceInput = document.getElementById("late_tolerance_mins");
const mayoUsernameInput = document.getElementById("mayo_username");
const mayoPasswordInput = document.getElementById("mayo_password");
const femasDomainnput = document.getElementById("femas_domain");
const femasUsernameInput = document.getElementById("femas_username");
const femasPasswordInput = document.getElementById("femas_password");
const sectionMayo = document.getElementById("section_mayo");
const sectionFemas = document.getElementById("section_femas");
const saveBtn = document.getElementById("save_btn");
const statusMsg = document.getElementById("status_msg");

function applyModuleVisibility(module) {
    if (module === "mayo") {
        sectionMayo.style.display = "";
        sectionFemas.style.display = "none";
    } else {
        sectionMayo.style.display = "none";
        sectionFemas.style.display = "";
    }
}

function populateForm(config) {
    moduleSelect.value = config.general.module;
    maxRetriesInput.value = config.general.max_retries;
    punchInInput.value = config.schedule.punch_in;
    punchOutInput.value = config.schedule.punch_out;
    delayStartInput.value = config.schedule.delay_start_mins;
    delayEndInput.value = config.schedule.delay_end_mins;
    lateToleranceInput.value = config.schedule.late_tolerance_mins;

    if (config.mayo) {
        mayoUsernameInput.value = config.mayo.username;
        mayoPasswordInput.value = config.mayo.password;
    }

    if (config.femas) {
        femasDomainnput.value = config.femas.domain;
        femasUsernameInput.value = config.femas.username;
        femasPasswordInput.value = config.femas.password;
    }

    applyModuleVisibility(config.general.module);
}

function buildConfig() {
    const module = moduleSelect.value;

    return {
        general: {
            module,
            max_retries: parseInt(maxRetriesInput.value, 10),
        },
        schedule: {
            punch_in: punchInInput.value,
            punch_out: punchOutInput.value,
            delay_start_mins: parseInt(delayStartInput.value, 10),
            delay_end_mins: parseInt(delayEndInput.value, 10),
            late_tolerance_mins: parseInt(lateToleranceInput.value, 10),
        },
        mayo: module === "mayo"
            ? { username: mayoUsernameInput.value, password: mayoPasswordInput.value }
            : null,
        femas: module === "femas"
            ? { domain: femasDomainnput.value, username: femasUsernameInput.value, password: femasPasswordInput.value }
            : null,
    };
}

function validate(config) {
    if (config.general.module === "mayo") {
        if (!config.mayo.username.trim()) return "Mayo 帳號不可為空";
        if (!config.mayo.password.trim()) return "Mayo 密碼不可為空";
    } else if (config.general.module === "femas") {
        if (!config.femas.domain.trim()) return "Femas 網域不可為空";
        if (!config.femas.username.trim()) return "Femas 帳號不可為空";
        if (!config.femas.password.trim()) return "Femas 密碼不可為空";
    }
    return null;
}

function showStatus(msg, isError = false) {
    statusMsg.textContent = msg;
    statusMsg.style.color = isError ? "#ff3b30" : "#86868b";
}

async function loadConfig() {
    try {
        const config = await invoke("get_config");
        populateForm(config);
    } catch (_) {
        // First run: config file doesn't exist yet — use defaults
        const config = await invoke("get_default_config");
        populateForm(config);
    }
}

moduleSelect.addEventListener("change", () => {
    applyModuleVisibility(moduleSelect.value);
    statusMsg.textContent = "";
});

saveBtn.addEventListener("click", async () => {
    const config = buildConfig();
    const error = validate(config);

    if (error) {
        showStatus(error, true);
        return;
    }

    try {
        await invoke("save_config", { config });
        showStatus("已儲存，請重新啟動 Daka 以套用變更");
    } catch (err) {
        showStatus(`儲存失敗：${err}`, true);
    }
});

// Initialize on page load
loadConfig();
