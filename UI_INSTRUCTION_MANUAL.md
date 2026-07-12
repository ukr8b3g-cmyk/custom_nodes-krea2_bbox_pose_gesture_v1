# UI方針

`Arm Preset` と `Both Hands Preset` は意味が重なりやすいため統合します。

## 表示順
1. Basic: Enable / Target / Human
2. Whole Body: Base Pose / Performance / Sitting / Lying / Pair
3. Body: Torso / Lower Body / Arms
4. Hands & Direction: Right Hand / Left Hand / Head / Gaze
5. Advanced: Strength / Stabilizer / Merge

## 合成ルール
- Arm Preset は腕全体・両手系を担当
- Right Hand / Left Hand は片手単位の追加仕草
- Torso Preset は体幹のひねり・前傾・反りなど
- Lower Body は足・脚の形
- Sitting は座り・膝立ち・しゃがみ、Lying は寝そべり・リクライニングを担当
- Sitting または Lying が選ばれた場合、Base Pose と Lower Body は競合しやすいため無効化
- Sitting と Lying が同時に指定された場合は Lying を優先
- 旧 Sitting / Lying の保存値は新しい欄へ自動移行
