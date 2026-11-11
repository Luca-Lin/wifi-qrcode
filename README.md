# WiFi QR Code 產生器

輸入 WiFi 名稱與密碼，產生 QR Code。訪客用手機相機掃描，就能直接連上網路。

線上使用：https://luca-lin.github.io/wifi-qrcode/

## 功能

- 支援 WPA / WPA2、WPA2 / WPA3 混合、僅 WPA3（SAE）、WEP 與開放網路
- 支援隱藏網路（SSID 不廣播）
- SSID 與密碼可使用中文（以 UTF-8 編碼）
- 依加密方式檢查密碼格式，例如 WPA2 需為 8–63 個字元或 64 位十六進位金鑰
- 下載 PNG，或直接列印成卡片（列印時一律印出完整密碼，方便手動輸入）
- 支援深色模式與手機版面

## 隱私

所有資料都在瀏覽器裡處理，不會上傳到任何伺服器。

## 使用方式

純靜態網頁，不需要安裝或建置。直接用瀏覽器開啟 `index.html` 即可。

## 加密方式說明

QR Code 內的 `T:` 欄位只描述金鑰類型，實際使用 WPA、WPA2 或 WPA3 是手機連線時和路由器協商的：

| 選項 | QR Code 內容 | 說明 |
| --- | --- | --- |
| WPA2 / WPA3 混合 | `T:WPA` | 建議選項，相容性最好 |
| WPA / WPA2 | `T:WPA` | 與上一項產生相同的 QR Code，分開列出方便對照路由器設定 |
| 僅 WPA3（SAE） | `T:SAE` | 目前只確定 Android 10 以上支援，部分 iPhone 或舊手機可能無法掃描 |
| WEP | `T:WEP` | 不安全，僅供舊設備使用 |
| 無密碼 | `T:nopass` | 開放網路 |

## 檔案

- `index.html`：頁面
- `app.js`：產生 WiFi 字串、驗證輸入、繪製 QR Code
- `style.css`：樣式（含列印與深色模式）
- `qrcode.min.js`：[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)，Kazuhiko Arase，MIT License

## 授權

`qrcode.min.js` 依 MIT License 授權，著作權屬原作者。
