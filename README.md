# NEON TETRIS

用純 HTML / CSS / JavaScript 寫的現代俄羅斯方塊。零依賴、零建置工具、單一靜態資料夾，
直接開 `index.html` 就能玩，也可以丟上 GitHub Pages。

## 遊戲規則

實作的是現代 Tetris Guideline 的核心手感，不是簡化版：

- **7-bag 亂數** — 每七個方塊為一袋洗牌，不會連續十幾個抽不到 I 塊
- **SRS 旋轉 + 完整踢牆表** — 卡在牆邊或地板時會自動位移，含 I 塊專用踢牆表
- **Lock delay 0.5 秒 + 移動重置** — 落地後有半秒微調空間，上限 15 次重置
- **Hold（每塊限一次）／ Next 預覽 5 個 ／ Ghost 落點虛影**
- **Hard drop 瞬落 ＋ Soft drop 軟降**，分別給 2 分 / 1 分每格
- **DAS / ARR 可調** — 長按左右的首次延遲與連移間隔，在設定裡用滑桿調整
- **標準計分與等級曲線** — 單/雙/三/四消 100/300/500/800 × 等級，每 10 行升一級

## 操作

| 鍵盤 | 動作 |
|---|---|
| ← → | 移動 |
| ↓ | 軟降 |
| Space | 瞬落 |
| ↑ / X | 順時針旋轉 |
| Z / Ctrl | 逆時針旋轉 |
| C / Shift | 暫存（Hold） |
| P / Esc | 暫停 |
| R | 重新開始 |

手機：左右拖曳移動、輕點旋轉、下滑軟降、快速下滑瞬落、上滑暫存，另有畫面下方的按鈕。

## 其他

- 最高分與設定存在 `localStorage`，不需要後端
- 音效與主題音樂全部用 Web Audio API 即時合成，沒有任何音檔
- 支援深色霓虹介面、手機直橫向、`prefers-reduced-motion`

## 檔案結構

```
index.html
css/style.css
js/constants.js    方塊形狀、SRS 踢牆表、重力曲線、計分表
js/board.js        場地格狀資料、碰撞、消行
js/randomizer.js   7-bag
js/game.js         遊戲規則與狀態機
js/renderer.js     Canvas 繪製、粒子、震動
js/input.js        鍵盤 DAS/ARR 與觸控手勢
js/audio.js        合成音效與主題音樂
js/storage.js      localStorage
js/main.js         組裝與主迴圈
```

## 本機執行

直接開 `index.html` 即可。若要用伺服器：

```bash
python3 -m http.server 8000
# 開 http://localhost:8000
```
