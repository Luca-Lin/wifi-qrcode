(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("wifi-form");
  const ssidInput = $("ssid");
  const passInput = $("password");
  const encSelect = $("encryption");
  const hiddenInput = $("hidden");
  const passGroup = $("password-group");
  const togglePass = $("toggle-password");
  const canvas = $("qr-canvas");
  const errorEl = $("error");
  const hint = $("hint");
  const infoSsid = $("info-ssid");
  const infoPass = $("info-pass");
  const downloadBtn = $("download");
  const printBtn = $("print");

  const DEFAULT_HINT = hint.textContent;

  // 讓中文等非 ASCII 的 SSID / 密碼以 UTF-8 編碼。
  // 註：此函式庫不支援 ECI 標記，但 iOS / Android 內建相機都會自動辨識 UTF-8。
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  }

  const utf8Length = (s) => new TextEncoder().encode(s).length;
  const isHex = (s) => /^[0-9A-Fa-f]+$/.test(s);
  const isPrintableAscii = (s) => /^[\x20-\x7E]*$/.test(s);

  // WiFi QR 格式中，\ ; , : " 需要跳脫
  const escapeWifiField = (s) => s.replace(/([\\;,:"])/g, "\\$1");

  // 值為 encryption 下拉選單的 value，對應到 QR 內的 T: 欄位。
  // T: 只描述「金鑰類型」，實際用 WPA、WPA2 或 WPA3 是手機連線時和路由器協商的。
  // 因此「WPA / WPA2」與「WPA2 / WPA3 混合」都輸出 T:WPA；選項分開只是方便使用者對照路由器設定。
  const TYPE_MAP = { "WPA2/WPA3": "WPA", WPA: "WPA", SAE: "SAE", WEP: "WEP", nopass: "nopass" };

  function buildWifiString({ ssid, password, encryption, hidden }) {
    // SSID 一律不加引號：Android 會自行處理，而 iOS 可能把引號當成名稱的一部分
    let str = `WIFI:T:${TYPE_MAP[encryption]};S:${escapeWifiField(ssid)};`;
    // 密碼不加引號：64 位 hex（WPA PSK）與 10/26/58 位 hex（WEP）本來就該被當成 hex
    if (encryption !== "nopass") str += `P:${escapeWifiField(password)};`;
    if (hidden) str += "H:true;";
    return str + ";";
  }

  function validate({ ssid, password, encryption }) {
    if (!ssid.trim()) return "請輸入網路名稱（SSID）";
    if (utf8Length(ssid) > 32) return "SSID 最多 32 個位元組（中文字一個佔 3 個位元組）";

    const type = TYPE_MAP[encryption];
    if (type === "WPA") {
      const isRawPsk = password.length === 64 && isHex(password);
      if (!isRawPsk) {
        if (!isPrintableAscii(password)) return "WPA2 密碼只能包含英文、數字與一般符號（ASCII）";
        if (password.length < 8 || password.length > 63) {
          return "WPA2 密碼長度需為 8–63 個字元，或 64 位十六進位金鑰";
        }
      }
    }
    if (type === "SAE") {
      // SAE 不支援 64 位 hex 金鑰；Android 要求 8–63 個可列印 ASCII 字元
      if (!isPrintableAscii(password)) return "WPA3 密碼只能包含英文、數字與一般符號（ASCII）";
      if (password.length < 8 || password.length > 63) return "WPA3 密碼長度需為 8–63 個字元";
    }
    if (type === "WEP") {
      // 掃描器只把 10/26/58 位 hex 當成金鑰，其他長度會被當成文字密碼
      const asciiOk = isPrintableAscii(password) && [5, 13, 29].includes(password.length);
      const hexOk = isHex(password) && [10, 26, 58].includes(password.length);
      if (!asciiOk && !hexOk) {
        return "WEP 金鑰需為 5、13 或 29 個 ASCII 字元，或 10、26 或 58 位十六進位數字";
      }
    }
    return "";
  }

  // 若內容超出 QR Code 容量會丟出例外，由呼叫端處理
  function drawQR(text) {
    const qr = qrcode(0, "M"); // 0 = 自動選擇版本
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const margin = 4; // 安靜區
    const size = 640;
    const cell = Math.floor(size / (count + margin * 2));
    const offset = Math.floor((size - cell * count) / 2);

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
      }
    }
    canvas.classList.add("ready");
  }

  // 跳脫後仍可能被部分掃描器（如 Android 內建）誤讀的值
  function scannerWarnings(label, value) {
    const warnings = [];
    if (value.endsWith("\\")) warnings.push(`注意：${label}以反斜線 \\ 結尾，部分 Android 手機可能讀錯`);
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      warnings.push(`注意：${label}前後是雙引號，部分手機會把引號去掉，可能無法連線`);
    }
    return warnings;
  }

  function getData() {
    return {
      ssid: ssidInput.value,
      password: passInput.value,
      encryption: encSelect.value,
      hidden: hiddenInput.checked,
    };
  }

  // 目前畫面上 QR Code 所對應的資料；null 表示沒有有效的 QR
  let current = null;

  function clearResult(message = DEFAULT_HINT) {
    current = null;
    canvas.width = 320;
    canvas.height = 320;
    canvas.classList.remove("ready");
    canvas.setAttribute("aria-label", "尚未產生 QR Code");
    infoSsid.textContent = "—";
    infoPass.textContent = "";
    hint.textContent = message;
    downloadBtn.disabled = true;
    printBtn.disabled = true;
  }

  const passwordVisible = () => passInput.type === "text";

  function span(className, text) {
    const el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
  }

  // 畫面上依 👁 狀態遮罩密碼；列印時由 CSS 改顯示 .pass-print，一律印出完整密碼
  function renderInfo() {
    if (!current) return;
    infoSsid.textContent = `網路：${current.ssid}`;
    if (current.encryption === "nopass") {
      infoPass.textContent = "無需密碼";
    } else {
      const full = `密碼：${current.password}`;
      const screen = passwordVisible() ? full : `密碼：${"•".repeat(8)}`;
      infoPass.replaceChildren(span("pass-screen", screen), span("pass-print", full));
    }

    const notes = ["用手機相機掃描即可加入 WiFi"];
    if (current.ssid !== current.ssid.trim()) notes.push("注意：SSID 前後有空白，請確認是否正確");
    notes.push(...scannerWarnings("SSID ", current.ssid));
    if (current.encryption !== "nopass") notes.push(...scannerWarnings("密碼", current.password));
    if (current.encryption !== "nopass" && !passwordVisible()) {
      notes.push("密碼已隱藏，點密碼欄的眼睛圖示可在畫面上顯示（列印時一律會印出密碼）");
    }
    hint.textContent = notes.join("。");
  }

  function generate() {
    const data = getData();
    const err = validate(data);
    if (err) {
      errorEl.textContent = err;
      clearResult();
      return;
    }

    try {
      drawQR(buildWifiString(data));
      canvas.setAttribute("aria-label", `WiFi QR Code：${data.ssid}`);
    } catch (e) {
      console.error(e);
      errorEl.textContent = "內容太長，無法產生 QR Code，請縮短 SSID 或密碼";
      clearResult();
      return;
    }

    errorEl.textContent = "";
    current = data;
    renderInfo();
    downloadBtn.disabled = false;
    printBtn.disabled = false;
  }

  const syncPasswordGroup = () => {
    passGroup.style.display = encSelect.value === "nopass" ? "none" : "";
  };
  encSelect.addEventListener("change", syncPasswordGroup);
  syncPasswordGroup(); // 瀏覽器可能還原表單狀態

  // 任何欄位變更後，舊的 QR Code 與錯誤訊息就不再正確
  const invalidate = () => {
    errorEl.textContent = "";
    if (current) clearResult("資料已變更，請重新產生 QR Code");
  };
  form.addEventListener("input", invalidate);
  form.addEventListener("change", invalidate);

  togglePass.addEventListener("click", () => {
    const show = !passwordVisible();
    passInput.type = show ? "text" : "password";
    togglePass.setAttribute("aria-label", show ? "隱藏密碼" : "顯示密碼");
    togglePass.setAttribute("aria-pressed", String(show));
    renderInfo();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    generate();
  });

  downloadBtn.addEventListener("click", () => {
    if (!current) return;
    const a = document.createElement("a");
    const name = current.ssid.trim().replace(/[\\/:*?"<>|]/g, "_");
    a.download = `wifi-${name}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  printBtn.addEventListener("click", () => window.print());
})();
