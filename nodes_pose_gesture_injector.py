"""
Krea2 BBOX Pose Preset / Gesture Injector V1 (Composable Best)
"""
from __future__ import annotations
import copy, hashlib, json, os
from typing import Any, Dict, List, Optional, Tuple
REGIONS=("red","blue","yellow","green","magenta")
NONE_OPTION="None / なし"
STABILIZER_AUTO_OPTION="Any / 自動"
TARGET_SLOT_OPTIONS=("Auto first human","All human slots","RED slot","BLUE slot","YELLOW slot","GREEN slot","MAGENTA slot")
HUMAN_TYPE_OPTIONS=("Female","Male","Unisex")
STRENGTH_OPTIONS=("Natural","Clear","Strong")
STABILIZER_OPTIONS=(NONE_OPTION,STABILIZER_AUTO_OPTION,"Hand / 手","Body / 体","Full Body / 全身","Hand + Body / 手+体","Pair / 2人")
MERGE_STYLE_OPTIONS=("Comma","Sentence","New line")
HUMAN_WORDS=("girl","woman","female","lady","schoolgirl","bride","idol","1girl","女","女性","女の子","少女","boy","man","male","gentleman","groom","1boy","男","男性","男の子","少年","person","people","character","anime girl","anime boy","human","warrior","dancer","人物","人間","人")
FEMALE_WORDS=("girl","woman","female","lady","schoolgirl","bride","idol","anime girl","1girl","女性","女の子","少女")
MALE_WORDS=("boy","man","male","gentleman","groom","anime boy","1boy","男性","男の子","少年")
AUTO_STABILIZERS={"Hand":"hand clearly visible, accurate fingers, natural hand anatomy","Body":"clear body pose, natural posture","Full Body":"full body visible, clear body pose, natural posture","Pair":"both people clearly visible, clear relationship between the two characters"}
FALLBACK_LIBRARY={"version":"fallback","presets":[{"id":"peace_sign","display_name":"Peace Sign / ピース","scope":"hand_expression","family":"Basic Sign / 基本サイン","action":"Gesture / サイン","target":"Hand / 手","gender":"unisex","reliability":"high","priority":1,"aliases":["peace sign","v sign","ピース"],"prompt":"making a peace sign with the right hand near the face","stabilizer":"hand clearly visible, fingers clearly separated"}]}
TWO_HAND_HINT_IDS={"covering_both_eyes","both_hands_behind_head","both_hands_behind_neck","both_arms_raised","stretching_arms_up","both_hands_on_chest","hands_near_chest","both_hands_on_waist","both_hands_on_hips","hands_folded_front","one_hand_over_other","hands_on_knees","hands_on_thighs","arms_wrapped_knees","hands_beside_legs_sitting","air_quotes","two_hand_heart","cat_paw","hands_near_cheeks","prayer_hands","fingers_interlaced","hands_clasped_front","hands_covering_lower_face","mystical_hand_seal","ninja_hand_seal"}
ARM_PRESET_IDS={"arms_crossed","arms_lightly_folded","hands_behind_back","one_arm_across_body","adjusting_collar","adjusting_tie","holding_sleeve","hand_near_neck","touching_shoulder","one_shoulder_lowered","jacket_over_shoulder","relaxed_shoulders","hand_on_collarbone","holding_skirt_edge_upper","hand_on_upper_arm","hands_gently_in_front","elbows_close_to_body","one_hand_opposite_elbow"}
TORSO_PRESET_IDS={"torso_twist","forward_lean","backward_arch","side_bend","shoulder_turn","chest_open","hip_tilt_torso","soft_s_curve_torso","deep_forward_bend","deep_back_arch","strong_torso_twist","right_side_lean","left_side_lean"}
ARM_CONFLICT_IDS_WITH_BOTH_HANDS={"arms_crossed","arms_lightly_folded","hands_behind_back","one_arm_across_body"}
def _clean(v:Any)->str:return str(v or "").strip()
def _lower(v:Any)->str:return _clean(v).lower()

def _clean_custom_add_on(value: Any) -> str:
    text = _clean(value)
    if _lower(text) in {'', 'auto', 'none', 'none / なし', 'なし', 'null'}:
        return ''
    return text
def _load_json_file(filename:str,fallback:Dict[str,Any])->Dict[str,Any]:
    path=os.path.join(os.path.dirname(__file__),filename)
    try:
        with open(path,'r',encoding='utf-8') as f:data=json.load(f)
        if isinstance(data,dict):return data
    except Exception:pass
    return fallback
LIBRARY=_load_json_file('pose_gesture_presets.json',FALLBACK_LIBRARY)
PRESETS=[p for p in LIBRARY.get('presets',[]) if isinstance(p,dict)]
def _preset_sort_key(p:Dict[str,Any])->Tuple[int,int,str]:
    rel={"high":10,"standard":20,"medium":20,"hard":30}.get(_lower(p.get('reliability')),20)
    return (rel,int(p.get('priority',9999)),_clean(p.get('display_name')))
PRESETS.sort(key=_preset_sort_key)
def _as_bool(v:Any)->bool:
    return v if isinstance(v,bool) else _lower(v) in {'true','1','yes','on'}
def _safe_json_loads(data:Any)->Optional[Any]:
    if isinstance(data,(dict,list)):return copy.deepcopy(data)
    try:return json.loads(str(data or ''))
    except Exception:return None
def _json_dumps(data:Any)->str:return json.dumps(data,ensure_ascii=False,separators=(',',':'))
def _slot_text(slot_data:Any)->str:
    if not isinstance(slot_data,dict):return ''
    return ' '.join(_clean(slot_data.get(k)) for k in ('prompt','label','desc','description') if _clean(slot_data.get(k))).lower()
def _looks_human(slot_data:Any)->bool:
    return isinstance(slot_data,dict) and _lower(slot_data.get('type'))!='text' and any(w.lower() in _slot_text(slot_data) for w in HUMAN_WORDS)
def _looks_gender(slot_data:Any,human_type:str)->bool:
    if human_type=='Unisex':return True
    text=_slot_text(slot_data)
    return any(w.lower() in text for w in (FEMALE_WORDS if human_type=='Female' else MALE_WORDS))
def _get_slots(data:Any)->Dict[str,Any]:
    if not isinstance(data,dict):return {}
    slots=data.get('slots')
    return slots if isinstance(slots,dict) else {}
def _target_slots(slots:Dict[str,Any],target_slot:str,human_type:str)->List[str]:
    if target_slot=='All human slots':return [s for s in REGIONS if _looks_human(slots.get(s))]
    if target_slot=='Auto first human':
        gender=[s for s in REGIONS if _looks_human(slots.get(s)) and _looks_gender(slots.get(s),human_type)]
        if gender:return gender[:1]
        humans=[s for s in REGIONS if _looks_human(slots.get(s))]
        return humans[:1]
    mapping={"RED slot":"red","BLUE slot":"blue","YELLOW slot":"yellow","GREEN slot":"green","MAGENTA slot":"magenta"}
    s=mapping.get(target_slot)
    return [s] if s in REGIONS else []
def _is_two_hand_preset(preset:Dict[str,Any])->bool:
    pid=_clean(preset.get('id'))
    if pid in TWO_HAND_HINT_IDS:return True
    text=' '.join([_clean(preset.get('display_name')),_clean(preset.get('family')),_clean(preset.get('prompt'))]).lower()
    return any(m in text for m in ('both hands','both palms','both arms','two-hand','two hands','hands together','fingers interlaced','air quotes','hand seal','両手','合掌','印'))
def _preset_options_for_category(category_id:str,predicate):
    mapping={}; options=[NONE_OPTION]
    for p in PRESETS:
        if not predicate(p):continue
        label=_clean(p.get('display_name')) or _clean(p.get('id'))
        if not label:continue
        uniq=label if label not in mapping else f"{label} [{_clean(p.get('id'))}]"
        mapping[uniq]=p; options.append(uniq)
    return tuple(options),mapping
PRESETS_BY_CATEGORY_DISPLAY={}
def _setup_category(category_id:str,predicate):
    options,mapping=_preset_options_for_category(category_id,predicate)
    PRESETS_BY_CATEGORY_DISPLAY[category_id]=mapping
    return options
BASE_POSE_PRESET_OPTIONS=_setup_category('base_pose',lambda p:_clean(p.get('scope'))=='full_body')
ARM_PRESET_OPTIONS=_setup_category('arm',lambda p:(_clean(p.get('id')) in ARM_PRESET_IDS) or (_clean(p.get('scope'))=='hand_expression' and _is_two_hand_preset(p)))
TORSO_PRESET_OPTIONS=_setup_category('torso',lambda p:_clean(p.get('id')) in TORSO_PRESET_IDS)
GAZE_PRESET_OPTIONS=_setup_category('gaze',lambda p:_clean(p.get('scope'))=='gaze')
HEAD_PRESET_OPTIONS=_setup_category('head',lambda p:_clean(p.get('scope'))=='head')
RIGHT_HAND_PRESET_OPTIONS=_setup_category('right_hand',lambda p:_clean(p.get('scope'))=='hand_expression' and not _is_two_hand_preset(p))
LEFT_HAND_PRESET_OPTIONS=_setup_category('left_hand',lambda p:_clean(p.get('scope'))=='hand_expression' and not _is_two_hand_preset(p))
SITTING_LYING_PRESET_OPTIONS=_setup_category('sitting_lying',lambda p:_clean(p.get('scope'))=='sitting_lying')
SITTING_PRESET_OPTIONS=_setup_category('sitting',lambda p:_clean(p.get('scope'))=='sitting_lying' and _clean(p.get('family'))!='Lying / 寝そべり')
LYING_PRESET_OPTIONS=_setup_category('lying',lambda p:_clean(p.get('scope'))=='sitting_lying' and _clean(p.get('family'))=='Lying / 寝そべり')
LOWER_BODY_PRESET_OPTIONS=_setup_category('lower_body',lambda p:_clean(p.get('scope'))=='lower_body')
PERFORMANCE_PRESET_OPTIONS=_setup_category('performance',lambda p:_clean(p.get('scope'))=='performance')
PAIR_PRESET_OPTIONS=_setup_category('pair',lambda p:_clean(p.get('scope'))=='pair')
def _append_unique(base:str,addition:str)->str:
    base,addition=_clean(base),_clean(addition)
    if not addition:return base
    if not base:return addition
    return base if addition in base else f"{base}, {addition}"
def _append_phrase_unique(parts:List[str],phrase:str)->None:
    phrase=_clean(phrase)
    if phrase and phrase.lower() not in {p.lower() for p in parts}:parts.append(phrase)
def _side_specific_one_hand_prompt(prompt:str,side:str)->str:
    side='left' if side=='left' else 'right'; text=_clean(prompt)
    if not text:return text
    replacements=[('right hand',f'{side} hand'),('left hand',f'{side} hand'),('right index finger',f'{side} index finger'),('left index finger',f'{side} index finger'),('with one hand',f'with the {side} hand'),('placing one hand',f'placing the {side} hand'),('resting one hand',f'resting the {side} hand'),('raising one hand',f'raising the {side} hand'),('raising one arm',f'raising the {side} arm'),('extending one hand',f'extending the {side} hand'),('one open palm',f'the {side} open palm'),('one palm',f'the {side} palm'),('covering the mouth with one hand',f'covering the mouth with the {side} hand'),('covering one eye with one hand',f'covering one eye with the {side} hand'),('partially covering the face with one hand',f'partially covering the face with the {side} hand'),('touching one cheek with one hand',f'touching one cheek with the {side} hand'),('touching the chin with one hand',f'touching the chin with the {side} hand'),('touching the forehead with one hand',f'touching the forehead with the {side} hand'),('brushing hair away from the face with one hand',f'brushing hair away from the face with the {side} hand'),('pointing forward with the right index finger',f'pointing forward with the {side} index finger'),('pointing to oneself with the right hand',f'pointing to oneself with the {side} hand'),('crossing the index and middle fingers of the right hand',f'crossing the index and middle fingers of the {side} hand'),('placing the index finger',f'placing the {side} index finger')]
    for old,new in replacements:text=text.replace(old,new)
    lt=text.lower()
    if all(t not in lt for t in (f'{side} hand',f'{side} arm',f'{side} index finger')):text=f'{text}, with the {side} hand'
    return text
def _apply_strength(base:str,strength:str)->str:
    return f'clear pose, {base}' if strength=='Clear' else (f'clear intentional pose, {base}, pose clearly visible' if strength=='Strong' else base)
def _append_prompt(base:str,addition:str,merge_style:str)->str:
    base,addition=_clean(base),_clean(addition)
    if not addition:return base
    if not base:return addition
    if addition in base:return base
    if merge_style=='Sentence':return base.rstrip('.。 ')+'. '+addition+'.'
    if merge_style=='New line':return base.rstrip()+'\n'+addition
    return base.rstrip(',， ') + ', ' + addition
def _node_result(data:Any,pose_text:str,debug_text:str):
    display_text=_clean(pose_text) or _clean(debug_text)
    return {"ui":{"text":[display_text]},"result":(_json_dumps(data) if isinstance(data,dict) else data,pose_text,debug_text)}
def _selected_preset(category_id:str,display:str)->Optional[Dict[str,Any]]:
    display=_clean(display)
    return None if (not display or display==NONE_OPTION) else PRESETS_BY_CATEGORY_DISPLAY.get(category_id,{}).get(display)
def _build_pose_text(base_pose_preset,arm_preset,right_hand_preset,left_hand_preset,torso_preset,lower_body_preset,sitting_lying_preset,performance_preset,pair_preset,strength,custom_add_on,stabilizer,gaze_preset=NONE_OPTION,head_preset=NONE_OPTION,sitting_preset=NONE_OPTION,lying_preset=NONE_OPTION):
    warnings=[]; selected_meta=[]; parts=[]; selected_presets=[]
    base_p=_selected_preset('base_pose',base_pose_preset)
    arm_p=_selected_preset('arm',arm_preset)
    torso_p=_selected_preset('torso',torso_preset)
    gaze_p=_selected_preset('gaze',gaze_preset)
    head_p=_selected_preset('head',head_preset)
    right_p=_selected_preset('right_hand',right_hand_preset)
    left_p=_selected_preset('left_hand',left_hand_preset)
    legacy_pose_p=_selected_preset('sitting_lying',sitting_lying_preset)
    sitting_p=_selected_preset('sitting',sitting_preset)
    lying_p=_selected_preset('lying',lying_preset)
    lower_p=_selected_preset('lower_body',lower_body_preset)
    perf_p=_selected_preset('performance',performance_preset)
    pair_p=_selected_preset('pair',pair_preset)
    if lying_p and sitting_p: warnings.append('Sitting Preset was ignored because Lying Preset is selected.'); sitting_p=None
    if (lying_p or sitting_p) and legacy_pose_p: warnings.append('Legacy Sitting / Lying Preset was ignored because a new pose preset is selected.'); legacy_pose_p=None
    body_pose_p=lying_p or sitting_p or legacy_pose_p
    body_pose_name='Lying' if lying_p else ('Sitting' if sitting_p else 'Sitting / Lying')
    if body_pose_p and base_p: warnings.append('Base Pose was ignored because Sitting or Lying is selected.'); base_p=None
    if body_pose_p and lower_p: warnings.append('Lower Body was ignored because Sitting or Lying is selected.'); lower_p=None
    ordered=[('Base Pose',base_p,None),('Hands',arm_p,None),('Right Hand',right_p,'right'),('Left Hand',left_p,'left'),('Torso',torso_p,None),('Gaze',gaze_p,None),('Head',head_p,None),('Lower Body',lower_p,None),(body_pose_name,body_pose_p,None),('Performance',perf_p,None),('Pair',pair_p,None)]
    for channel_name,preset,hand_side in ordered:
        if not preset:continue
        prompt=_clean(preset.get('prompt'))
        if hand_side in {'right','left'}:prompt=_side_specific_one_hand_prompt(prompt,hand_side)
        if prompt:
            _append_phrase_unique(parts,prompt); selected_presets.append(preset); selected_meta.append(f"{channel_name}: {_clean(preset.get('display_name')) or _clean(preset.get('id'))}")
    custom_add_on=_clean_custom_add_on(custom_add_on)
    if custom_add_on:_append_phrase_unique(parts,custom_add_on); selected_meta.append('Custom Add-on')
    if not parts:return '', selected_meta, 'No category preset selected and Custom Add-on is empty.'
    base=', '.join(parts); base=_apply_strength(base,strength)
    extras=[]
    if stabilizer==STABILIZER_AUTO_OPTION:
        scope_tags={_clean(p.get('scope')) for p in selected_presets}
        specific=[_clean(p.get('stabilizer')) for p in selected_presets if _clean(p.get('stabilizer'))]
        for s in specific:_append_phrase_unique(extras,s)
        if not extras:
            if 'pair' in scope_tags:_append_phrase_unique(extras,AUTO_STABILIZERS['Pair'])
            elif 'hand_expression' in scope_tags:_append_phrase_unique(extras,AUTO_STABILIZERS['Hand'])
            if scope_tags & {'full_body','sitting_lying','lower_body','performance'}:_append_phrase_unique(extras,AUTO_STABILIZERS['Full Body'])
            elif scope_tags & {'upper_body'}:_append_phrase_unique(extras,AUTO_STABILIZERS['Body'])
    elif stabilizer in {'Hand / 手','Body / 体','Full Body / 全身','Pair / 2人'}:
        _append_phrase_unique(extras,AUTO_STABILIZERS[stabilizer.split(' /')[0]])
    elif stabilizer=='Hand + Body / 手+体':
        _append_phrase_unique(extras,AUTO_STABILIZERS['Hand']); _append_phrase_unique(extras,AUTO_STABILIZERS['Body'])
    for extra in extras:base=_append_unique(base,extra)
    return base, selected_meta, ' '.join(warnings).strip()
class Krea2BBOXPoseGestureInjectorV1:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{
            'prompt_ui_data':('KREA2_ELEMENT_PROMPT_DATA',),
            'enable_pose_preset':('BOOLEAN',{'default':True}),
            'target_slot':(TARGET_SLOT_OPTIONS,{'default':'RED slot'}),
            'human_type':(HUMAN_TYPE_OPTIONS,{'default':'Female'}),
            'base_pose_preset':(BASE_POSE_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'arm_preset':(ARM_PRESET_OPTIONS,{'default':NONE_OPTION,'label':'Hands Preset'}),
            'right_hand_preset':(RIGHT_HAND_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'left_hand_preset':(LEFT_HAND_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'torso_preset':(TORSO_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'gaze_preset':(GAZE_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'head_preset':(HEAD_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'lower_body_preset':(LOWER_BODY_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'sitting_lying_preset':(SITTING_LYING_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'performance_preset':(PERFORMANCE_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'pair_preset':(PAIR_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'strength':(STRENGTH_OPTIONS,{'default':'Natural'}),
            'stabilizer':(STABILIZER_OPTIONS,{'default':NONE_OPTION}),
            'merge_style':(MERGE_STYLE_OPTIONS,{'default':'Comma'}),
            'sitting_preset':(SITTING_PRESET_OPTIONS,{'default':NONE_OPTION}),
            'lying_preset':(LYING_PRESET_OPTIONS,{'default':NONE_OPTION}),
        }}
    RETURN_TYPES=('KREA2_ELEMENT_PROMPT_DATA','STRING','STRING')
    RETURN_NAMES=('prompt_ui_data','pose_text','debug_text')
    FUNCTION='execute'; CATEGORY='Krea2/BBOX Prompter Suite'
    def execute(self,prompt_ui_data,enable_pose_preset,target_slot,human_type,base_pose_preset,arm_preset,right_hand_preset,left_hand_preset,torso_preset,lower_body_preset,sitting_lying_preset,performance_preset,pair_preset,strength,stabilizer,merge_style,sitting_preset=NONE_OPTION,lying_preset=NONE_OPTION,custom_add_on='',gaze_preset=NONE_OPTION,head_preset=NONE_OPTION):
        data=_safe_json_loads(prompt_ui_data)
        if not isinstance(data,dict):return _node_result(prompt_ui_data,'','Invalid prompt_ui_data. Connect after Krea2 BBOX Prompter.')
        if not _as_bool(enable_pose_preset):return _node_result(data,'','Pose preset disabled. Output passed through unchanged.')
        slots=_get_slots(data)
        if not slots:return _node_result(data,'','No slots found in prompt_ui_data. Expected Krea2 BBOX Prompter output.')
        pose_text,selected_meta,warning=_build_pose_text(base_pose_preset,arm_preset,right_hand_preset,left_hand_preset,torso_preset,lower_body_preset,sitting_lying_preset,performance_preset,pair_preset,strength,custom_add_on,stabilizer,gaze_preset,head_preset,sitting_preset,lying_preset)
        if not pose_text:return _node_result(data,'',f'No pose text generated. {warning}'.strip())
        targets=_target_slots(slots,target_slot,human_type); changed=[]; skipped=[]; explicit_slot=target_slot not in ('Auto first human','All human slots')
        for slot_name in targets:
            slot=slots.get(slot_name)
            if not isinstance(slot,dict): skipped.append(f'{slot_name}: missing slot'); continue
            if _lower(slot.get('type'))=='text': skipped.append(f'{slot_name}: text slot'); continue
            if not explicit_slot and not _looks_human(slot): skipped.append(f'{slot_name}: not detected as human'); continue
            slot['prompt']=_append_prompt(_clean(slot.get('prompt')),pose_text,merge_style); changed.append(slot_name)
        if not targets:debug='No target slot found. Try explicit RED/BLUE slot or add human words such as woman/man/character to the target prompt.'
        elif changed:
            summary='; '.join(selected_meta) if selected_meta else 'Custom Add-on'
            debug=f"Applied to {', '.join(changed)}. Selected: {summary}."
            if warning:debug+=' '+warning
            if skipped:debug+=' Skipped: ' + '; '.join(skipped)
        else: debug='No slot changed. Skipped: ' + '; '.join(skipped)
        return _node_result(data,pose_text,debug)
    @classmethod
    def IS_CHANGED(cls,*args,**kwargs):
        payload=json.dumps([args,kwargs,LIBRARY.get('version')],ensure_ascii=False,sort_keys=True,default=str)
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()
NODE_CLASS_MAPPINGS={'Krea2BBOXPoseGestureInjectorV1':Krea2BBOXPoseGestureInjectorV1}
NODE_DISPLAY_NAME_MAPPINGS={'Krea2BBOXPoseGestureInjectorV1':'🧍 Krea2 BBOX Pose Preset V1'}
