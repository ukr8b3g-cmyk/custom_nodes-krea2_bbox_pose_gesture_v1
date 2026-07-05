# Krea2 BBOX Pose Preset V1

Krea2 BBOX Prompter Suite向けの、ポーズ補助ノードです。BBOX Prompterの `prompt_ui_data` に接続し、選択したポーズ文を対象スロットのプロンプトへ追加します。

## 簡単な使い方
1. `Krea2 BBOX Prompter` の `prompt_ui_data` をこのノードへ接続します。
2. `target_slot` で反映先を選びます。通常は `RED slot` など明示指定が分かりやすいです。
3. 必要なプリセットを1つ、または矛盾しない範囲で複数選びます。
4. 下部の `Prompt Preview` で出力予定の自然文を確認します。
5. 後段へ `prompt_ui_data` をつなぎます。

## 各セクション
- `Base Pose`: 立ち姿などの基本姿勢。
- `Hands Preset`: 両手・腕まわりのポーズ。`Heart Arms` はこちらです。
- `Right Hand Preset` / `Left Hand Preset`: 片手のサインや手の動き。`L/W/I Sign` はこちらです。
- `Torso Preset`: 胴体のひねり、前傾、反りなど。
- `Gaze Preset`: 視線方向。表情指定ではありません。
- `Head Preset`: 頭や首の向き。
- `Lower Body Preset`: 脚、膝、足先のポーズ。
- `Sitting / Lying Preset`: 座り・寝そべり系。選択時は `Base Pose` と `Lower Body Preset` を無視します。
- `Performance Preset`: 定型ポーズ、ダンス、スポーツ、全身サイン。`T/Y/X/O Sign` はこちらです。
- `Pair Preset`: 2人用の位置関係や接触ポーズ。

## 設定
- `Strength`
  - `Natural`: そのまま追加。
  - `Clear`: `clear pose` を追加。
  - `Strong`: `clear intentional pose` と `pose clearly visible` を追加。
- `Stabilizer`
  - 補助文を追加して、手・全身・2人構図の安定を狙います。
  - 迷う場合は `None / なし` または `Any / 自動`。
- `Merge Style`
  - `Comma`: カンマで追加。通常推奨。
  - `Sentence`: 文として追加。
  - `New line`: 改行で追加。

## 追加サイン
- 指サイン: `L Sign`, `W Sign`, `I Sign`
- 全身サイン: `T Sign`, `Y Sign`, `X Sign`, `O Sign`
- 腕サイン: `Heart Arms`

## 注意
- 強い全身ポーズは1つだけ選ぶ方が安定します。
- 手・腕系は比較的重ねやすいですが、左右や姿勢が矛盾しないようにしてください。
- `Sitting / Lying Preset` と立ち姿・下半身系は競合しやすいです。
- 古いワークフロー由来の `custom_add_on` は内部互換用で、通常UIには表示しません。

## 仕様
- 入力: `KREA2_ELEMENT_PROMPT_DATA`
- 出力: `prompt_ui_data`, `pose_text`, `debug_text`
- ノード下部の `Prompt Preview` は、ドロップダウン変更だけで即時更新されます。
- プリセット一覧は `pose_gesture_presets.json` で管理します。
- Web UI用JSは `web/krea2_pose_gesture_live_preview.js` です。

## 手動導入
1. 古い同系フォルダを削除または退避します。
2. このフォルダを `ComfyUI/custom_nodes/` に入れます。
3. ComfyUIを再起動します。
4. ブラウザを `Ctrl + F5` で更新します。
