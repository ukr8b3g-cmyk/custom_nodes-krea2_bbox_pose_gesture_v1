# Krea2 BBOX Pose Preset V1 (Arm Merged Plus)

置き換え用のカスタムノードです。

## 主な更新
- `Arm Preset` に両手系プリセットを統合
- UI順を整理
  - Base Pose
  - Arm Preset / Hands Preset
  - Right Hand Preset
  - Left Hand Preset
  - Torso Preset
  - Gaze Preset
  - Head Preset
  - Lower Body Preset
  - Sitting / Lying Preset
  - Performance Preset
  - Pair Preset
- `strength` の下に `stabilizer`
- 旧 `custom_add_on` 入力欄はUIから非表示化
- Pair Preset を大幅追加
- Performance Preset を大幅追加
- Gaze / Head / Lower Body のプリセットを追加
- ノード下部の表示欄は、JSONではなく出力予定の自然文プロンプトを表示

## 使い方の目安
- **Strength**
  - `Natural`: そのまま追加。通常はこれ。
  - `Clear`: `clear pose` を追加。少し強め。
  - `Strong`: `clear intentional pose` と `pose clearly visible` を追加。強め。
- **Stabilizer**
  - 補助文を足して安定化を狙う機能。
  - `Any / 自動`: 選んだプリセットに応じて、手・全身・2人向けの補助文を自動追加。
  - 迷う場合は `None / なし` か `Any / 自動`。
- **Merge Style**
  - `Comma`: カンマで追加。推奨。
  - `Sentence`: 文として追加。
  - `New line`: 改行で追加。

## ポーズ重ねがけの注意
- `Arm Preset`、`Right Hand Preset`、`Left Hand Preset` は重ねて使いやすいです。
- `Gaze Preset` は視線、`Head Preset` は頭・首の向きです。表情指定ではありません。
- `Sitting / Lying Preset` を使う場合、`Base Pose` と `Lower Body Preset` は競合しやすいため無効化されます。
- `Performance Preset` の強い全身ポーズは、他の全身・下半身・座り系プリセットと同時に使うと矛盾しやすいです。
- 特に `Bridge Pose`、`Handstand`、`Backflip`、`High Kick`、`Breakdance Freeze` のような大きな姿勢は、基本的に1つだけ選ぶ方が安定します。

## 手動導入
1. 古い同系フォルダを削除または退避
2. このフォルダを `ComfyUI/custom_nodes/` に入れる
3. ComfyUI再起動
4. ワークフロー上の古いノードは削除して置き直す

## 表示欄
ノード下部には、実行後に出力された自然文の `pose_text` が表示されます。旧 `custom_add_on` 欄は内部互換用として残し、通常のUIには表示しません。

## 安全対策
古いワークフロー由来で `custom_add_on` に `Auto`, `None`, `None / なし`, `なし` が残っている場合は、誤混入防止のため無視します。
