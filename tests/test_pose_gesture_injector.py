import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from nodes_pose_gesture_injector import Krea2BBOXPoseGestureInjectorV1, PRESETS, PRESETS_BY_CATEGORY_DISPLAY, NONE_OPTION

def sample_data():
    return {"version":"krea2_element_prompt_ui_v1","scene":"","background":"","slots":{"red":{"type":"obj","prompt":"A woman standing outdoors","framing":"Auto","angle":"Auto"},"blue":{"type":"obj","prompt":"a small cat","framing":"Auto","angle":"Auto"},"yellow":{"type":"obj","prompt":"","framing":"Auto","angle":"Auto"},"green":{"type":"text","prompt":"hello","framing":"Auto","angle":"Auto"},"magenta":{"type":"obj","prompt":"A man wearing a jacket","framing":"Auto","angle":"Auto"}}}

def preset_label(category_id, preset_id):
    for label, preset in PRESETS_BY_CATEGORY_DISPLAY[category_id].items():
        if preset.get("id") == preset_id: return label
    raise AssertionError(f"missing preset {category_id}:{preset_id}")

def call(node, data, **overrides):
    args=dict(prompt_ui_data=json.dumps(data,ensure_ascii=False),enable_pose_preset=True,target_slot="RED slot",human_type="Unisex",base_pose_preset=NONE_OPTION,arm_preset=NONE_OPTION,torso_preset=NONE_OPTION,right_hand_preset=NONE_OPTION,left_hand_preset=NONE_OPTION,sitting_lying_preset=NONE_OPTION,lower_body_preset=NONE_OPTION,performance_preset=NONE_OPTION,pair_preset=NONE_OPTION,strength="Natural",custom_add_on="",stabilizer=NONE_OPTION,merge_style="Comma")
    args.update(overrides)
    result=node.execute(**args)
    return result["result"] if isinstance(result,dict) else result

def test_combine_multiple_channels():
    node=Krea2BBOXPoseGestureInjectorV1()
    out,pose,debug=call(node,sample_data(),arm_preset=preset_label("arm","arms_crossed"),torso_preset=preset_label("torso","torso_twist"),lower_body_preset=preset_label("lower_body","one_knee_bent"),right_hand_preset=preset_label("right_hand","peace_sign"))
    assert "arms crossed" in pose or "arms crossed" in out.lower()
    assert "twisting the upper body slightly" in pose
    assert "one knee slightly bent" in pose
    assert "right hand" in pose

def test_sitting_overrides_base_and_lower_body():
    node=Krea2BBOXPoseGestureInjectorV1()
    out,pose,debug=call(node,sample_data(),base_pose_preset=preset_label("base_pose","neutral_standing"),sitting_lying_preset=preset_label("sitting_lying","seiza"),lower_body_preset=preset_label("lower_body","wide_stance"))
    assert "seiza pose" in pose
    assert "standing naturally" not in pose
    assert "feet apart" not in pose
    assert "ignored" in debug.lower()

def test_right_left_both_can_combine():
    node=Krea2BBOXPoseGestureInjectorV1()
    out,pose,debug=call(node,sample_data(),right_hand_preset=preset_label("right_hand","shushing"),left_hand_preset=preset_label("left_hand","touching_cheek"),arm_preset=preset_label("arm","prayer_hands"))
    assert "right index finger" in pose
    assert "left hand" in pose
    assert "both palms" in pose.lower()

def test_explicit_slot_always_applies():
    node=Krea2BBOXPoseGestureInjectorV1()
    data=sample_data(); data["slots"]["red"]["prompt"]="plain subject"
    out,pose,debug=call(node,data,base_pose_preset=preset_label("base_pose","neutral_standing"))
    parsed=json.loads(out)
    assert "standing naturally" in parsed["slots"]["red"]["prompt"]

def test_all_categories_have_options():
    for category in ["base_pose","arm","torso","gaze","head","right_hand","left_hand","sitting_lying","lower_body","performance","pair"]:
        assert len(PRESETS_BY_CATEGORY_DISPLAY[category]) > 0
    assert len(PRESETS) >= 160

def test_sign_presets_are_in_expected_categories():
    for preset_id in ["l_sign", "w_sign", "i_sign"]:
        assert preset_label("right_hand", preset_id)
        assert preset_label("left_hand", preset_id)
    assert preset_label("arm", "heart_arms")
    for preset_id in ["t_sign_body", "y_sign_body", "x_sign_body", "o_sign_body"]:
        assert preset_label("performance", preset_id)

def test_torso_and_lower_body_recent_presets():
    for preset_id in ["deep_forward_bend", "deep_back_arch", "strong_torso_twist", "right_side_lean", "left_side_lean"]:
        assert preset_label("torso", preset_id)
    for preset_id in ["crossed_legs", "knees_together_feet_apart", "ballet_arabesque_legs"]:
        assert preset_label("lower_body", preset_id)
    for preset_id in ["deep_squat", "street_squat", "low_lunge_kneel", "kneel_leg_back", "sitting_backwards", "butterfly_sitting", "legs_forward_sitting", "casual_floor_sitting", "back_lean_sitting"]:
        assert preset_label("sitting_lying", preset_id)
    arabesque_labels = [
        label for label, preset in PRESETS_BY_CATEGORY_DISPLAY["lower_body"].items()
        if "Arabesque" in label or "アラベスク" in label
    ]
    assert arabesque_labels == ["Ballet Arabesque Legs / アラベスク脚"]

def test_pinup_presets_are_in_performance():
    for preset_id in ["classic_pinup", "hand_on_hip_pinup", "over_shoulder_pinup", "one_leg_lift_pinup", "seated_pinup"]:
        assert preset_label("performance", preset_id)

if __name__ == "__main__":
    test_combine_multiple_channels(); test_sitting_overrides_base_and_lower_body(); test_right_left_both_can_combine(); test_explicit_slot_always_applies(); test_all_categories_have_options(); test_sign_presets_are_in_expected_categories(); test_torso_and_lower_body_recent_presets(); test_pinup_presets_are_in_performance(); print("ok")


def test_custom_auto_is_ignored():
    node=Krea2BBOXPoseGestureInjectorV1()
    out,pose,debug=call(node,sample_data(),base_pose_preset=preset_label("base_pose","neutral_standing"),custom_add_on="Auto")
    assert "Auto" not in pose
    assert "standing naturally" in pose
