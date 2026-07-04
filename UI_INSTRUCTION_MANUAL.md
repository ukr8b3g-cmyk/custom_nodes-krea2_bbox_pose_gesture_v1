# UI方針

`Arm Preset` と `Both Hands Preset` は意味が重なりやすいため統合します。

## 表示順
1. Base Pose
2. Arm Preset / Hands Preset（腕・両手）
3. Right Hand Preset
4. Left Hand Preset
5. Torso Preset
6. Gaze Preset
7. Head Preset
8. Lower Body Preset
9. Sitting / Lying Preset
10. Performance Preset
11. Pair Preset

## 合成ルール
- Arm Preset は腕全体・両手系を担当
- Right Hand / Left Hand は片手単位の追加仕草
- Torso Preset は体幹のひねり・前傾・反りなど
- Lower Body は足・脚の形
- Sitting / Lying は座り・寝そべりの基本姿勢
- Sitting / Lying が選ばれた場合、Base Pose と Lower Body は競合しやすいため無効化
