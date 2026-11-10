/** Arrangement starting points; categories are listening contexts, not rigid genres.
 * Base parts carry pulse and harmony; colour-part arpeggios own the busy upper register.
 * Sustained pads frame breakbeats, short keys answer dance kicks, and ballads keep breathing room.
 * Keep each authored combination explicit: tempo alone does not determine its instrumentation. */
export const genres = Object.freeze([
  { id: 'vocal_sky', group: 'ボカロ', label: 'コネクト・スカイ', bpm: 128, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'supersaw', melody: 'lead-saw' },
  { id: 'vocal_room', group: 'ボカロ', label: 'ワンルーム・アンテナ', bpm: 112, rhythm: 'edm_shuffle', swing: 12, bass: 'synth', bassPattern: 'line_hook', drum: 'electronic', backing: 'stabs', chord: 'electric', melody: 'lead-round' },
  { id: 'vocal_cut', group: 'ボカロ', label: 'ピクセル・コラージュ', bpm: 136, rhythm: 'fragment_clock', swing: 0, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'stabs', chord: 'pluck', melody: 'lead-box' },
  { id: 'vocal_piano', group: 'ボカロ', label: '午前零時のタイプライター', bpm: 142, rhythm: 'piano_skip', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'eighths', chord: 'piano', melody: 'lead-glass' },
  { id: 'vocal_garage', group: 'ボカロ', label: '放課後ガレージ', bpm: 140, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'strum', chord: 'saw-brass', melody: 'lead-reed' },
  { id: 'vocal_letter', group: 'ボカロ', label: '六畳半のラブレター', bpm: 94, rhythm: 'half_ballad', swing: 0, bass: 'acoustic', bassPattern: 'support_half', drum: 'acoustic', backing: 'bass-chord', chord: 'felt', melody: 'lead-flute' },
  { id: 'vocal_dance', group: 'ボカロ', label: 'ネオン逃避行', bpm: 148, rhythm: 'disco_pickup', swing: 0, bass: 'electric', bassPattern: 'line_octave', drum: 'electronic', backing: 'cutting', chord: 'saw-brass', melody: 'lead-pulse' },
  { id: 'vocal_chip', group: 'ボカロ', label: 'ポケットの流星群', bpm: 144, rhythm: 'denpa_call', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'eighths', chord: 'pulse-stack', melody: 'lead-chip' },
  { id: 'vocal_theatre', group: 'ボカロ', label: 'からくり夜行', bpm: 136, rhythm: 'piano_skip', swing: 0, bass: 'acoustic', bassPattern: 'line_walk', drum: 'acoustic', backing: 'bass-chord', chord: 'organ', melody: 'lead-marimba' },
  { id: 'vocal_rocket', group: 'ボカロ', label: '透明ロケット', bpm: 194, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'eighths', chord: 'piano', melody: 'lead-saw' },
  { id: 'pop', group: 'J-POP', label: 'ハロー・ポップ', bpm: 100, rhythm: 'eight', swing: 0, bass: 'electric', bassPattern: 'pop', drum: 'acoustic', backing: 'quarters', chord: 'piano', melody: 'lead-round' },
  { id: 'parade_trance', group: '幻想エレクトロ', label: 'ラスト・カーテン', bpm: 144, rhythm: 'trance_roll', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'supersaw', melody: 'lead-supersaw' },
  { id: 'parade_shadow', group: '幻想エレクトロ', label: 'メリーゴーラウンドの裏側', bpm: 132, rhythm: 'fragment_clock', swing: 0, bass: 'synth', bassPattern: 'support_pulse', drum: 'electronic', backing: 'quarters', chord: 'bell', melody: 'lead-bowed' },
  { id: 'magic_satin', group: 'きらめきポップ', label: 'サテン・トリップ', bpm: 132, rhythm: 'disco_pickup', swing: 4, bass: 'electric', bassPattern: 'line_walk', drum: 'acoustic', backing: 'satin-comp', chord: 'electric', melody: 'lead-marimba' },
  { id: 'magic_prism', group: 'きらめきポップ', label: 'プリズム通信', bpm: 124, rhythm: 'sixteen_light', swing: 0, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'satin-comp', chord: 'electric', melody: 'bell' },
  { id: 'newmusic_coast', group: 'ニューミュージック', label: 'コーストライン・レター', bpm: 106, rhythm: 'sixteen_light', swing: 10, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'bass-chord', chord: 'electric', melody: 'lead-flute' },
  { id: 'newmusic_rain', group: 'ニューミュージック', label: '雨粒のポストカード', bpm: 88, rhythm: 'half_ballad', swing: 0, bass: 'electric', bassPattern: 'support_half', drum: 'acoustic', backing: 'whole', chord: 'felt', melody: 'bell' },
  { id: 'clear_horizon', group: 'ニューミュージック', label: '透きとおる水平線', bpm: 116, rhythm: 'eight_straight', swing: 0, bass: 'electric', bassPattern: 'straight4', drum: 'acoustic', backing: 'strum', chord: 'pluck', melody: 'lead-glass' },
  { id: 'clear_letter', group: 'ニューミュージック', label: '白い便箋', bpm: 78, rhythm: 'half_ballad', swing: 0, bass: 'electric', bassPattern: 'support_half', drum: 'acoustic', backing: 'whole', chord: 'piano', melody: 'soft' },
  { id: 'idol_prism', group: 'アニソン', label: 'プリズム・ディスコ', bpm: 128, rhythm: 'disco_pickup', swing: 0, bass: 'electric', bassPattern: 'line_octave', drum: 'electronic', backing: 'stabs', chord: 'saw-brass', melody: 'lead-round' },
  { id: 'piano_switch', group: 'J-POP', label: 'ピアノ・ジャグラー', bpm: 148, rhythm: 'sixteen_funk', swing: 18, bass: 'electric', bassPattern: 'line_hook', drum: 'acoustic', backing: 'satin-comp', chord: 'piano', melody: 'lead-glass' },
  { id: 'summer_lift', group: 'J-POP', label: 'サマー・スプラッシュ', bpm: 170, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'strum', chord: 'pluck', melody: 'electric' },
  { id: 'night_soul', group: 'J-POP', label: 'ミッドナイト・ソウル', bpm: 92, rhythm: 'half_rnb', swing: 16, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'satin-comp', chord: 'organ', melody: 'lead-reed' },
  { id: 'scene_paper', group: '同人音楽', label: 'ペーパー・チェンバー', bpm: 96, rhythm: 'sixteen_light', swing: 12, bass: 'acoustic', bassPattern: 'support_half', drum: 'acoustic', backing: 'bass-chord', chord: 'felt', melody: 'lead-marimba' },
  { id: 'scene_prism', group: '同人音楽', label: 'グラス・エレクトロ', bpm: 114, rhythm: 'fragment_clock', swing: 0, bass: 'synth', bassPattern: 'support_hold', drum: 'electronic', backing: 'stabs', chord: 'mallet', melody: 'lead-glass' },
  { id: 'scene_margin', group: '同人音楽', label: 'トワイライト歌謡', bpm: 92, rhythm: 'half_ballad', swing: 8, bass: 'acoustic', bassPattern: 'line_sing', drum: 'acoustic', backing: 'whole', chord: 'strings', melody: 'lead-bowed' },
  { id: 'scene_signal', group: '幻想エレクトロ', label: 'シグナル・ロスト', bpm: 123, rhythm: 'fragment_clock', swing: 0, bass: 'synth', bassPattern: 'support_pulse', drum: 'electronic', backing: 'stabs', chord: 'pulse-stack', melody: 'lead-pulse' },
  { id: 'scene_shadow', group: '幻想エレクトロ', label: 'シャドウ・オルゴール', bpm: 102, rhythm: 'half', swing: 0, bass: 'acoustic', bassPattern: 'support_half', drum: 'electronic', backing: 'quarters', chord: 'bell', melody: 'lead-box' },
  { id: 'scene_clock', group: '幻想エレクトロ', label: 'クロックワーク・チップ', bpm: 132, rhythm: 'sixteen_light', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'offbeat', chord: 'pulse-stack', melody: 'lead-chip' },
  { id: 'scene_blue', group: 'PCゲーム音楽', label: 'スカイブルー・トランス', bpm: 138, rhythm: 'trance_roll', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'saw-brass', melody: 'lead-saw' },
  { id: 'scene_night', group: 'PCゲーム音楽', label: 'デイブレイク・ユーロ', bpm: 154, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'stabs', chord: 'soft', melody: 'soft' },
  { id: 'scene_steel', group: 'PCゲーム音楽', label: 'アイアン・バトル', bpm: 142, rhythm: 'battle_gallop', swing: 0, bass: 'electric', bassPattern: 'straight16', drum: 'acoustic', backing: 'eighths', chord: 'saw-brass', melody: 'lead-saw' },
  { id: 'scene_dungeon', group: 'PCゲーム音楽', label: 'ラビリンス・フュージョン', bpm: 148, rhythm: 'sixteen_funk', swing: 8, bass: 'electric', bassPattern: 'line_relay', drum: 'acoustic', backing: 'cutting', chord: 'electric', melody: 'lead-reed' },
  { id: 'scene_call', group: '電波・アキバポップ', label: 'ハイパー・コール', bpm: 144, rhythm: 'denpa_call', swing: 0, bass: 'synth', bassPattern: 'line_octave', drum: 'electronic', backing: 'stabs', chord: 'mallet', melody: 'lead-chip' },
  { id: 'scene_toybox', group: '電波・アキバポップ', label: 'キャンディ・パニック', bpm: 188, rhythm: 'denpa_call', swing: 0, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'quarters', chord: 'mallet', melody: 'pluck' },
  { id: 'scene_march', group: '電波・アキバポップ', label: 'アフタースクール・マーチ', bpm: 142, rhythm: 'eight_straight', swing: 0, bass: 'electric', bassPattern: 'straight4', drum: 'acoustic', backing: 'bass-chord', chord: 'organ', melody: 'pluck' },
  { id: 'jpop_up', group: 'J-POP', label: 'ダッシュ！ポップ', bpm: 150, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'strum', chord: 'piano', melody: 'soft' },
  { id: 'jpop_ballad', group: 'J-POP', label: 'レター・バラード', bpm: 90, rhythm: 'half_ballad', swing: 0, bass: 'electric', bassPattern: 'support_half', drum: 'acoustic', backing: 'whole', chord: 'piano', melody: 'lead-flute' },
  { id: 'jpop_city', group: 'J-POP', label: 'ネオン・シティ', bpm: 108, rhythm: 'sixteen_light', swing: 15, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'satin-comp', chord: 'electric', melody: 'lead-round' },
  { id: 'novel_keys', group: 'J-POP', label: 'ナイトラン・ピアノ', bpm: 136, rhythm: 'piano_skip', swing: 0, bass: 'electric', bassPattern: 'line_sing', drum: 'electronic', backing: 'bass-chord', chord: 'piano', melody: 'lead-glass' },
  { id: 'pop_scene', group: 'J-POP', label: 'シーン・スキッパー', bpm: 164, rhythm: 'eight_drive', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'stabs', chord: 'pulse-stack', melody: 'lead-glass' },
  { id: 'break_rock', group: 'J-POP', label: 'ブレイクアウト・ロック', bpm: 142, rhythm: 'jungle_break', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'eighths', chord: 'organ', melody: 'lead-saw' },
  { id: 'pop_shadow', group: 'J-POP', label: 'アンバー・フォーク', bpm: 92, rhythm: 'half_ballad', swing: 0, bass: 'acoustic', bassPattern: 'support_half', drum: 'acoustic', backing: 'strum', chord: 'felt', melody: 'electric' },
  { id: 'midnight_disco', group: 'VTuberポップ', label: 'ミラーボール・ガール', bpm: 118, rhythm: 'disco_pickup', swing: 10, bass: 'electric', bassPattern: 'line_hook', drum: 'electronic', backing: 'cutting', chord: 'saw-brass', melody: 'lead-round' },
  { id: 'wordbeat', group: 'VTuberポップ', label: 'コトバ・ホッピング', bpm: 144, rhythm: 'broken_two', swing: 22, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'stabs', chord: 'pluck', melody: 'lead-pulse' },
  { id: 'vt_starlight', group: 'VTuberポップ', label: 'スターライト・サイン', bpm: 156, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'line_octave', drum: 'acoustic', backing: 'strum', chord: 'piano', melody: 'bell' },
  { id: 'vt_velvet', group: 'VTuberポップ', label: 'ベルベット・ナイト', bpm: 104, rhythm: 'half_rnb', swing: 24, bass: 'synth', bassPattern: 'support_pulse', drum: 'electronic', backing: 'satin-comp', chord: 'electric', melody: 'lead-round' },
  { id: 'vt_comet', group: 'VTuberポップ', label: 'コメット・ランナー', bpm: 178, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'strum', chord: 'piano', melody: 'pluck' },
  { id: 'vt_sugar', group: 'VTuberポップ', label: 'シュガー・ログイン', bpm: 166, rhythm: 'denpa_call', swing: 0, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'stabs', chord: 'mallet', melody: 'bell' },
  { id: 'vt_orbit', group: 'VTuberポップ', label: 'オービット・ドロップ', bpm: 128, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'saw-brass', melody: 'lead-chip' },
  { id: 'vt_letter', group: 'VTuberポップ', label: 'アンコールの手紙', bpm: 74, rhythm: 'half_ballad', swing: 0, bass: 'acoustic', bassPattern: 'support_hold', drum: 'acoustic', backing: 'whole', chord: 'felt', melody: 'soft' },
  { id: 'vt_neon', group: 'VTuberポップ', label: 'ネオン・ルーレット', bpm: 122, rhythm: 'disco_pickup', swing: 12, bass: 'electric', bassPattern: 'line_hook', drum: 'electronic', backing: 'cutting', chord: 'saw-brass', melody: 'lead-glass' },
  { id: 'vt_phantom', group: 'VTuberポップ', label: 'ファントム・ショー', bpm: 130, rhythm: 'broken_two', swing: 16, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'stabs', chord: 'pulse-stack', melody: 'lead-box' },
  { id: 'vt_soda', group: 'VTuberポップ', label: 'ソーダ・ホリデイ', bpm: 112, rhythm: 'sixteen_light', swing: 18, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'satin-comp', chord: 'electric', melody: 'mallet' },
  { id: 'vt_moon', group: 'VTuberポップ', label: 'ムーンライト・ルーム', bpm: 92, rhythm: 'half_rnb', swing: 30, bass: 'synth', bassPattern: 'support_hold', drum: 'electronic', backing: 'whole', chord: 'pad', melody: 'lead-flute' },
  { id: 'vt_spark', group: 'VTuberポップ', label: 'スパーク・チェイサー', bpm: 172, rhythm: 'jungle_break', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'stabs', chord: 'organ', melody: 'pluck' },
  { id: 'vt_prism', group: 'VTuberポップ', label: 'プリズム・ジャンプ', bpm: 148, rhythm: 'piano_skip', swing: 0, bass: 'electric', bassPattern: 'line_relay', drum: 'electronic', backing: 'quarters', chord: 'piano', melody: 'bell' },
  { id: 'vt_crown', group: 'VTuberポップ', label: 'クラウン・マーチ', bpm: 142, rhythm: 'eight_straight', swing: 0, bass: 'electric', bassPattern: 'straight4', drum: 'acoustic', backing: 'bass-chord', chord: 'organ', melody: 'lead-reed' },
  { id: 'vt_horizon', group: 'VTuberポップ', label: 'ホライズン・コール', bpm: 160, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'whole', chord: 'supersaw', melody: 'lead-supersaw' },
  { id: 'vt_afterglow', group: 'VTuberポップ', label: '配信後のアフターグロウ', bpm: 94, rhythm: 'sixteen_light', swing: 22, bass: 'acoustic', bassPattern: 'line_walk', drum: 'acoustic', backing: 'satin-comp', chord: 'felt', melody: 'electric' },
  { id: 'anime_rock', group: 'アニソン', label: 'フルスロットル・ロック', bpm: 142, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'strum', chord: 'saw-brass', melody: 'lead-saw' },
  { id: 'anime_emotional', group: 'アニソン', label: 'エモーショナル・ブルーム', bpm: 138, rhythm: 'eight_straight', swing: 0, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'strum', chord: 'piano', melody: 'soft' },
  { id: 'anime_ballad', group: 'アニソン', label: 'エピローグ・バラード', bpm: 90, rhythm: 'half_ballad', swing: 0, bass: 'electric', bassPattern: 'support_hold', drum: 'acoustic', backing: 'whole', chord: 'strings', melody: 'lead-bowed' },
  { id: 'anime_electro', group: 'アニソン', label: 'スターライト・エレクトロ', bpm: 158, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'supersaw', melody: 'lead-supersaw' },
  { id: 'idol_bright', group: 'アイドル', label: 'スパークル・ステージ', bpm: 160, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'line_octave', drum: 'acoustic', backing: 'strum', chord: 'piano', melody: 'soft' },
  { id: 'idol_cute', group: 'アイドル', label: 'シュガー・ステップ', bpm: 142, rhythm: 'sixteen_light', swing: 0, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'quarters', chord: 'mallet', melody: 'lead-marimba' },
  { id: 'idol_dance', group: 'アイドル', label: 'スポットライト・ダンス', bpm: 128, rhythm: 'disco_pickup', swing: 0, bass: 'synth', bassPattern: 'line_octave', drum: 'electronic', backing: 'offbeat', chord: 'saw-brass', melody: 'lead-round' },
  { id: 'idol_emotional', group: 'アイドル', label: 'ラストシーン・アイドル', bpm: 145, rhythm: 'eight_straight', swing: 0, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'strum', chord: 'piano', melody: 'bell' },
  { id: 'kpop_dance', group: 'K-POP', label: 'グロッシー・ダンス', bpm: 120, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'line_hook', drum: 'electronic', backing: 'stabs', chord: 'pulse-stack', melody: 'lead-pulse' },
  { id: 'kpop_rnb', group: 'K-POP', label: 'ベルベット・ナイト', bpm: 92, rhythm: 'half_rnb', swing: 25, bass: 'synth', bassPattern: 'line_sing', drum: 'electronic', backing: 'satin-comp', chord: 'electric', melody: 'lead-round' },
  { id: 'kpop_bright', group: 'K-POP', label: 'ビタミン・ポップ', bpm: 128, rhythm: 'sixteen_pop', swing: 0, bass: 'electric', bassPattern: 'line_octave', drum: 'electronic', backing: 'stabs', chord: 'electric', melody: 'pluck' },
  { id: 'kpop_mellow', group: 'K-POP', label: 'スロウ・モーション', bpm: 84, rhythm: 'half_rnb', swing: 12, bass: 'synth', bassPattern: 'support_half', drum: 'electronic', backing: 'whole', chord: 'felt', melody: 'pluck' },
  { id: 'game_rpg', group: 'ゲーム音楽', label: 'ワンダー・クエスト', bpm: 126, rhythm: 'eight_straight', swing: 0, bass: 'electric', bassPattern: 'straight4', drum: 'acoustic', backing: 'whole', chord: 'strings', melody: 'lead-flute' },
  { id: 'game_battle', group: 'ゲーム音楽', label: 'ラスト・エンカウント', bpm: 144, rhythm: 'battle_gallop', swing: 0, bass: 'electric', bassPattern: 'straight16', drum: 'electronic', backing: 'eighths', chord: 'organ', melody: 'lead-reed' },
  { id: 'game_retro', group: 'ゲーム音楽', label: 'ピクセル・アドベンチャー', bpm: 130, rhythm: 'eight_straight', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'offbeat', chord: 'pulse-stack', melody: 'lead-chip' },
  { id: 'game_calm', group: 'ゲーム音楽', label: 'セーブポイント', bpm: 90, rhythm: 'off', swing: 0, bass: 'acoustic', bassPattern: 'support_hold', drum: 'acoustic', backing: 'whole', chord: 'felt', melody: 'lead-box' },
  { id: 'game_danmaku', group: 'ゲーム音楽', label: 'バレット・ラッシュ', bpm: 144, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'line_octave', drum: 'acoustic', backing: 'eighths', chord: 'piano', melody: 'lead-saw' },
  { id: 'game_danmaku_melody', group: 'ゲーム音楽', label: 'ファンタジア・ブルーム', bpm: 155, rhythm: 'sixteen_pop', swing: 0, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'stabs', chord: 'piano', melody: 'bell' },
  { id: 'game_indie_emotional', group: 'ゲーム音楽', label: 'メモリー・ボックス', bpm: 96, rhythm: 'off', swing: 0, bass: 'acoustic', bassPattern: 'support_half', drum: 'acoustic', backing: 'whole', chord: 'felt', melody: 'soft' },
  { id: 'game_indie_battle', group: 'ゲーム音楽', label: 'ハートビート・バトル', bpm: 160, rhythm: 'eight_drive', swing: 0, bass: 'synth', bassPattern: 'support_pulse', drum: 'electronic', backing: 'stabs', chord: 'organ', melody: 'bell' },
  { id: 'arc_shibuya', group: '音楽ゲーム', label: 'ウィークエンド・ギターポップ', bpm: 138, rhythm: 'sixteen_light', swing: 18, bass: 'electric', bassPattern: 'line_walk', drum: 'acoustic', backing: 'strum', chord: 'pluck', melody: 'lead-marimba' },
  { id: 'arc_swing', group: '音楽ゲーム', label: 'スウィング・カーニバル', bpm: 138, rhythm: 'jazz', swing: 96, bass: 'acoustic', bassPattern: 'line_walk', drum: 'acoustic', backing: 'satin-comp', chord: 'piano', melody: 'lead-reed' },
  { id: 'arc_toy', group: '音楽ゲーム', label: 'トイボックス・パレード', bpm: 174, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'line_relay', drum: 'acoustic', backing: 'stabs', chord: 'mallet', melody: 'pluck' },
  { id: 'arc_cabaret', group: '音楽ゲーム', label: 'ミュゼット・シアター', bpm: 124, rhythm: 'jazz', swing: 54, bass: 'acoustic', bassPattern: 'straight4', drum: 'acoustic', backing: 'offbeat', chord: 'organ', melody: 'lead-box' },
  { id: 'arc_trance', group: '音楽ゲーム', label: 'オーロラ・トランス', bpm: 142, rhythm: 'trance_roll', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'supersaw', melody: 'lead-supersaw' },
  { id: 'arc_tech', group: '音楽ゲーム', label: 'モノクロ・テクノ', bpm: 136, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'support_pulse', drum: 'electronic', backing: 'quarters', chord: 'pulse-stack', melody: 'lead-pulse' },
  { id: 'arc_piano', group: '音楽ゲーム', label: 'ピアノ・テンペスト', bpm: 186, rhythm: 'jungle_break', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'electronic', backing: 'quarters', chord: 'piano', melody: 'pluck' },
  { id: 'arc_pixel', group: '音楽ゲーム', label: 'ピコピコ・ハッピーコア', bpm: 144, rhythm: 'edm_speed', swing: 0, bass: 'synth', bassPattern: 'straight8', drum: 'electronic', backing: 'offbeat', chord: 'supersaw', melody: 'lead-chip' },
  { id: 'edm_nova', group: 'EDM・同人エレクトロ', label: 'ノヴァ・クラッシャー', bpm: 140, rhythm: 'edm_half', swing: 0, bass: 'synth', bassPattern: 'support_pulse', drum: 'electronic', backing: 'stabs', chord: 'supersaw', melody: 'lead-supersaw' },
  { id: 'edm_warp', group: 'EDM・同人エレクトロ', label: 'ワープ・ドライブ', bpm: 198, rhythm: 'edm_speed', swing: 0, bass: 'synth', bassPattern: 'straight16', drum: 'electronic', backing: 'stabs', chord: 'pulse-stack', melody: 'lead-pulse' },
  { id: 'edm_rain', group: 'EDM・同人エレクトロ', label: 'レインドロップ・スキップ', bpm: 132, rhythm: 'edm_future', swing: 15, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'offbeat', chord: 'mallet', melody: 'lead-glass' },
  { id: 'edm_float', group: 'EDM・同人エレクトロ', label: 'フローティング・キャンディ', bpm: 132, rhythm: 'edm_future', swing: 8, bass: 'synth', bassPattern: 'line_hook', drum: 'electronic', backing: 'stabs', chord: 'saw-brass', melody: 'lead-round' },
  { id: 'edm_glass', group: 'EDM・同人エレクトロ', label: 'グラス・カテドラル', bpm: 140, rhythm: 'jungle_break', swing: 0, bass: 'synth', bassPattern: 'support_hold', drum: 'electronic', backing: 'whole', chord: 'pad', melody: 'lead-bowed' },
  { id: 'edm_owl', group: 'EDM・同人エレクトロ', label: 'フクロウ・キャバレー', bpm: 126, rhythm: 'edm_shuffle', swing: 44, bass: 'synth', bassPattern: 'line_walk', drum: 'electronic', backing: 'bass-chord', chord: 'piano', melody: 'soft' },
  { id: 'edm_voyage', group: 'EDM・同人エレクトロ', label: 'アナログ・ヴォイジャー', bpm: 138, rhythm: 'trance_roll', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'supersaw', melody: 'lead-supersaw' },
  { id: 'edm_motor', group: 'EDM・同人エレクトロ', label: 'シンセ・モーター', bpm: 124, rhythm: 'edm_shuffle', swing: 14, bass: 'synth', bassPattern: 'line_octave', drum: 'electronic', backing: 'cutting', chord: 'pulse-stack', melody: 'lead-saw' },
  { id: 'edm_aria', group: 'EDM・同人エレクトロ', label: 'アルカディア・ピアノ', bpm: 180, rhythm: 'jungle_break', swing: 0, bass: 'synth', bassPattern: 'line_sing', drum: 'electronic', backing: 'quarters', chord: 'piano', melody: 'lead-saw' },
  { id: 'edm_confetti', group: 'EDM・同人エレクトロ', label: 'コンフェッティ・バースト', bpm: 200, rhythm: 'edm_speed', swing: 0, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'stabs', chord: 'mallet', melody: 'soft' },
  { id: 'edm_veil', group: 'EDM・同人エレクトロ', label: 'ヴェール・オブ・ミスト', bpm: 144, rhythm: 'edm_half', swing: 0, bass: 'synth', bassPattern: 'support_half', drum: 'electronic', backing: 'whole', chord: 'strings', melody: 'lead-flute' },
  { id: 'edm_ritual', group: 'EDM・同人エレクトロ', label: 'クリムゾン・リチュアル', bpm: 188, rhythm: 'edm_speed', swing: 0, bass: 'synth', bassPattern: 'support_pulse', drum: 'electronic', backing: 'quarters', chord: 'pulse-stack', melody: 'lead-saw' },
  { id: 'dance', group: 'ダンス・チル', label: 'ダンス・フロア', bpm: 120, rhythm: 'four_drive', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'soft', melody: 'bell' },
  { id: 'chill', group: 'ダンス・チル', label: 'ソファー・チル', bpm: 92, rhythm: 'half_rnb', swing: 20, bass: 'electric', bassPattern: 'chill', drum: 'acoustic', backing: 'whole', chord: 'felt', melody: 'lead-round' },
  { id: 'jazz', group: 'ジャズ', label: 'スモーキー・ジャズ', bpm: 120, rhythm: 'jazz', swing: 100, bass: 'acoustic', bassPattern: 'line_walk', drum: 'acoustic', backing: 'satin-comp', chord: 'piano', melody: 'lead-reed' },
  { id: 'dance_house', group: 'ダンス・チル', label: 'サンデー・ハウス', bpm: 124, rhythm: 'four', swing: 0, bass: 'synth', bassPattern: 'offbeat', drum: 'electronic', backing: 'offbeat', chord: 'saw-brass', melody: 'lead-round' },
  { id: 'garage', group: 'ダンス・チル', label: 'アーバン・ガラージ', bpm: 132, rhythm: 'broken_two', swing: 38, bass: 'synth', bassPattern: 'line_relay', drum: 'electronic', backing: 'stabs', chord: 'pluck', melody: 'lead-pulse' },
  { id: 'liquid', group: 'ダンス・チル', label: 'リキッド・スカイ', bpm: 174, rhythm: 'jungle_break', swing: 0, bass: 'synth', bassPattern: 'support_hold', drum: 'electronic', backing: 'whole', chord: 'pad', melody: 'lead-pulse' },
  { id: 'dub', group: 'ダンス・チル', label: 'サンセット・ダブ', bpm: 90, rhythm: 'one_drop', swing: 10, bass: 'electric', bassPattern: 'support_pulse', drum: 'acoustic', backing: 'offbeat', chord: 'organ', melody: 'lead-flute' },
  { id: 'glove', group: '洋楽ポップ', label: '街灯のムーンステップ', bpm: 116, rhythm: 'sixteen_funk', swing: 3, bass: 'electric', bassPattern: 'line_hook', drum: 'electronic', backing: 'cutting', chord: 'electric', melody: 'lead-saw' },
  { id: 'mirror', group: '洋楽ポップ', label: 'ミラー・ブギー', bpm: 122, rhythm: 'disco_pickup', swing: 0, bass: 'electric', bassPattern: 'line_octave', drum: 'acoustic', backing: 'cutting', chord: 'saw-brass', melody: 'lead-glass' },
  { id: 'radio', group: '洋楽ポップ', label: 'ラジオの帰り道', bpm: 84, rhythm: 'half_rnb', swing: 12, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'satin-comp', chord: 'electric', melody: 'soft' },
  { id: 'hammer', group: '洋楽ロック', label: '鉄橋のストンプ', bpm: 98, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'stabs', chord: 'organ', melody: 'soft' },
  { id: 'orbit', group: '洋楽ロック', label: '軌道上の残響', bpm: 68, rhythm: 'half_ballad', swing: 0, bass: 'electric', bassPattern: 'support_hold', drum: 'acoustic', backing: 'whole', chord: 'pad', melody: 'piano' },
  { id: 'ballroom', group: 'ジャズ', label: '1930s・真鍮のダンスホール', bpm: 152, rhythm: 'jazz', swing: 92, bass: 'acoustic', bassPattern: 'line_walk', drum: 'acoustic', backing: 'quarters', chord: 'piano', melody: 'soft' },
  { id: 'alley', group: 'ジャズ', label: '1940s・路地裏のビバップ', bpm: 182, rhythm: 'jazz', swing: 82, bass: 'acoustic', bassPattern: 'line_walk', drum: 'acoustic', backing: 'satin-comp', chord: 'piano', melody: 'soft' },
  { id: 'blueglass', group: 'ジャズ', label: '1950s末・青いモード', bpm: 110, rhythm: 'jazz', swing: 70, bass: 'acoustic', bassPattern: 'support_pulse', drum: 'acoustic', backing: 'whole', chord: 'piano', melody: 'soft' },
  { id: 'socket', group: 'ジャズ', label: '1970s・電気回路のファンク', bpm: 106, rhythm: 'sixteen_funk', swing: 8, bass: 'electric', bassPattern: 'line_hook', drum: 'acoustic', backing: 'stabs', chord: 'electric', melody: 'piano' },
  { id: 'paperstar', group: '同人音楽', label: '星図の余白', bpm: 92, rhythm: 'fragment_clock', swing: 0, bass: 'electric', bassPattern: 'support_half', drum: 'electronic', backing: 'whole', chord: 'felt', melody: 'mallet' },
  { id: 'spool', group: '同人音楽', label: '糸巻きの小劇場', bpm: 124, rhythm: 'sixteen_light', swing: 12, bass: 'acoustic', bassPattern: 'line_relay', drum: 'acoustic', backing: 'bass-chord', chord: 'mallet', melody: 'soft' },
  { id: 'signal', group: 'アニソン', label: '放課後の発射台', bpm: 168, rhythm: 'eight_drive', swing: 0, bass: 'electric', bassPattern: 'straight8', drum: 'acoustic', backing: 'strum', chord: 'piano', melody: 'soft' },
  { id: 'prismbell', group: 'アニソン', label: '変身前の一秒', bpm: 138, rhythm: 'disco_pickup', swing: 6, bass: 'electric', bassPattern: 'line_sing', drum: 'acoustic', backing: 'satin-comp', chord: 'electric', melody: 'soft' },
  { id: 'bitgate', group: '音楽ゲーム', label: 'ビット・ゲート', bpm: 188, rhythm: 'edm_speed', swing: 0, bass: 'synth', bassPattern: 'straight16', drum: 'electronic', backing: 'stabs', chord: 'pluck', melody: 'soft' },
  { id: 'nightlane', group: '音楽ゲーム', label: '深夜の判定線', bpm: 162, rhythm: 'broken_two', swing: 20, bass: 'synth', bassPattern: 'line_octave', drum: 'electronic', backing: 'stabs', chord: 'electric', melody: 'soft' },
])

/** Suggested progressions are starting points, not genre rules. */
export const genreProgressions = Object.freeze({
  vocal_sky: 'vocal-sky',
  vocal_room: 'vocal-room',
  vocal_cut: 'vocal-cut',
  vocal_piano: 'vocal-piano',
  vocal_garage: 'vocal-garage',
  vocal_letter: 'vocal-letter',
  vocal_dance: 'vocal-dance',
  vocal_chip: 'vocal-chip',
  vocal_theatre: 'vocal-theatre',
  vocal_rocket: 'vocal-rocket',

  glove: 'glove',
  mirror: 'mirror',
  radio: 'radio',
  hammer: 'hammer',
  orbit: 'orbit',
  ballroom: 'ballroom',
  alley: 'alley',
  blueglass: 'blueglass',
  socket: 'socket',
  paperstar: 'paperstar',
  spool: 'spool',
  signal: 'signal',
  prismbell: 'prismbell',
  bitgate: 'bitgate',
  nightlane: 'nightlane',
  parade_trance: 'parade-trance',
  parade_shadow: 'parade-shadow',
  magic_satin: 'magic-satin',
  magic_prism: 'magic-prism',
  newmusic_coast: 'newmusic-coast',
  newmusic_rain: 'newmusic-rain',
  clear_horizon: 'clear-horizon',
  clear_letter: 'clear-letter',

  edm_nova: 'edm-nova',
  edm_warp: 'edm-warp',
  edm_rain: 'edm-rain',
  edm_float: 'edm-float',
  edm_glass: 'edm-glass',
  edm_owl: 'edm-owl',
  edm_voyage: 'edm-voyage',
  edm_motor: 'edm-motor',
  edm_aria: 'edm-aria',
  edm_confetti: 'edm-confetti',
  edm_veil: 'edm-veil',
  edm_ritual: 'edm-ritual',

  idol_prism: 'idol-prism',
  piano_switch: 'piano-switch',
  summer_lift: 'summer-lift',
  night_soul: 'night-soul',
  novel_keys: 'novel-keys',
  pop_scene: 'pop-scene',
  break_rock: 'break-rock',
  pop_shadow: 'pop-shadow',
  midnight_disco: 'midnight-disco',
  wordbeat: 'wordbeat',
  vt_starlight: 'vt-starlight',
  vt_velvet: 'vt-velvet',
  vt_comet: 'vt-comet',
  vt_sugar: 'vt-sugar',
  vt_orbit: 'vt-orbit',
  vt_letter: 'vt-letter',
  vt_neon: 'vt-neon',
  vt_phantom: 'vt-phantom',
  vt_soda: 'vt-soda',
  vt_moon: 'vt-moon',
  vt_spark: 'vt-spark',
  vt_prism: 'vt-prism',
  vt_crown: 'vt-crown',
  vt_horizon: 'vt-horizon',
  vt_afterglow: 'vt-afterglow',

  arc_shibuya: 'arc-shibuya',
  arc_swing: 'arc-swing',
  arc_toy: 'arc-toy',
  arc_cabaret: 'arc-cabaret',
  arc_trance: 'arc-trance',
  arc_tech: 'arc-tech',
  arc_piano: 'arc-piano',
  arc_pixel: 'arc-pixel',
  scene_paper: 'scene-paper',
  scene_prism: 'scene-prism',
  scene_margin: 'scene-margin',
  scene_signal: 'scene-signal',
  scene_shadow: 'scene-shadow',
  scene_clock: 'scene-clock',
  scene_blue: 'scene-blue',
  scene_night: 'scene-night',
  scene_steel: 'scene-steel',
  scene_dungeon: 'scene-dungeon',
  scene_call: 'scene-call',
  scene_toybox: 'scene-toybox',
  scene_march: 'scene-march',
  pop: 'royal', jpop_up: 'lift-4561', jpop_ballad: 'one-canon', jpop_city: 'one-city',
  anime_rock: 'full-throttle-rock', anime_emotional: 'royal-dominant', anime_ballad: 'iv-minor', anime_electro: 'komuro',
  idol_bright: 'sparkle-stage', idol_cute: 'four-one-five-six', idol_dance: 'pop', idol_emotional: 'last-scene-idol',
  kpop_dance: 'club-hook', kpop_rnb: 'velvet-rnb', kpop_bright: 'bright-disco', kpop_mellow: 'slow-motion',
  game_rpg: 'one-canon', game_battle: 'six-dark', game_retro: 'lift-4565', game_calm: 'one-floating',
  game_danmaku: 'spell-flight', game_danmaku_melody: 'moon-flight',
  game_indie_emotional: 'save-room', game_indie_battle: 'clockwork-battle',
  dance: 'sensitive', chill: 'two-float', jazz: 'jazz', dance_house: 'six-funk',
  garage: 'garage-shuffle', liquid: 'liquid-break', dub: 'dub-yard',
})

/** Delay the second eighth note from halfway to two thirds of a beat. @param {number} pulse @param {number} swing */
export function swungBeat(pulse, swing) {
  const amount = Math.max(0, Math.min(100, swing)) / 100
  return pulse / 2 + (pulse % 2 ? amount * amount / 6 : 0)
}

/** Swing eighth notes while keeping sixteenths in order within each beat.
 * @param {number} pulse @param {number} swing */
export function swungBassBeat(pulse, swing) {
  const beat = pulse / 2
  const whole = Math.floor(beat)
  const fraction = beat - whole
  // Give subtle settings a lighter touch while retaining the full triplet at 100%.
  const amount = Math.max(0, Math.min(100, swing)) / 100
  const midpoint = 0.5 + amount * amount / 6
  return whole + (fraction <= 0.5 ? fraction * midpoint * 2 : midpoint + (fraction - 0.5) * (1 - midpoint) * 2)
}

/** @param {string} genre @param {number} root @param {number} [bar] */
export function bassEvents(genre, root, bar = 0) {
  // Alternating phrases retain a recognizable motif, with space and held notes.
  const linePhrases = {
    // The short pickup answers across the backbeat, leaving room for a vocal hook.
    line_hook: [
      [[0, 0.62, 0.98, 'root'], [1.5, 0.18, 0.66, 'octave'], [3, 0.37, 0.82, 'root'], [4, 0.68, 0.92, 'root'], [6.5, 0.23, 0.75, 'fifth']],
      [[0, 0.85, 0.95, 'root'], [2.5, 0.22, 0.67, 'fifth'], [3.5, 0.19, 0.86, 'octave'], [5, 0.52, 0.87, 'root'], [7, 0.28, 0.73, 'octave']],
    ],
    // A held downbeat, then a little staircase of chord tones.
    line_relay: [
      [[0, 1.35, 0.95, 'root'], [3, 0.20, 0.72, 'third'], [3.5, 0.20, 0.80, 'fifth'], [4, 0.68, 0.88, 'octave'], [6, 0.64, 0.78, 'fifth']],
      [[0, 0.86, 0.94, 'root'], [2, 0.42, 0.74, 'third'], [4, 0.95, 0.88, 'fifth'], [6.5, 0.20, 0.71, 'third'], [7, 0.34, 0.82, 'root']],
    ],
    line_walk: [
      [[0, 0.82, 0.94, 'root'], [2, 1.25, 0.72, 'third'], [5, 0.36, 0.8, 'fifth'], [6, 0.68, 0.72, 'third']],
      [[0, 0.85, 0.94, 'root'], [2, 0.65, 0.7, 'third'], [4, 1.15, 0.86, 'fifth'], [7, 0.32, 0.68, 'third']],
    ],
    line_sing: [
      [[0, 1.25, 0.96, 'root'], [3, 0.35, 0.7, 'third'], [4, 1.15, 0.88, 'fifth'], [7, 0.28, 0.7, 'third']],
      [[0, 0.65, 0.94, 'root'], [1.5, 1.2, 0.74, 'third'], [4.5, 0.32, 0.8, 'fifth'], [5.5, 0.85, 0.72, 'third']],
    ],
    line_octave: [
      [[0, 0.36, 0.95, 'root'], [1, 1.15, 0.75, 'octave'], [4, 0.28, 0.86, 'root'], [5, 0.7, 0.7, 'fifth'], [7, 0.3, 0.8, 'octave']],
      [[0, 0.75, 0.95, 'root'], [2, 0.32, 0.74, 'fifth'], [3, 1.1, 0.84, 'octave'], [6, 0.28, 0.72, 'root'], [7, 0.32, 0.8, 'octave']],
    ],
  }
  const phrase = linePhrases[/** @type {keyof typeof linePhrases} */ (genre)]
  if (phrase) return phrase[Math.abs(bar) % phrase.length].map(([pulse, duration, velocity, tone]) => ({
    pulse: /** @type {number} */ (pulse), duration: /** @type {number} */ (duration),
    velocity: /** @type {number} */ (velocity), tone: /** @type {string} */ (tone), midi: root,
  }))
  const patterns = {
    straight4: [0, 2, 4, 6],
    straight8: [0, 1, 2, 3, 4, 5, 6, 7],
    straight16: Array.from({ length: 16 }, (_, i) => i / 2),
    support_hold: [0],
    support_half: [0, 4],
    support_pulse: [0, 3, 4, 7],
    pop: [0, 2, 4, 6, 7],
    dance: [0, 1, 2, 3, 4, 5, 6, 7],
    chill: [0, 3, 5, 6],
    jazz: [0, 2, 4, 6],
    offbeat: [1, 3, 5, 7],
    off: [],
  }
  const pulses =
    patterns[/** @type {keyof typeof patterns} */ (genre)] ?? patterns.pop
  // Durations are in beats, so articulation follows the tempo.
  const articulation = {
    straight4: [[0.82, 0.96], [0.65, 0.7], [0.8, 0.88], [0.55, 0.73]],
    straight8: [[0.42, 0.98], [0.25, 0.6], [0.38, 0.82], [0.22, 0.6], [0.42, 0.9], [0.25, 0.62], [0.36, 0.8], [0.22, 0.7]],
    straight16: Array.from({ length: 16 }, (_, i) => [i % 4 === 0 ? 0.21 : 0.14, i % 4 === 0 ? 0.94 : i % 2 === 0 ? 0.72 : 0.52]),
    support_hold: [[3.8, 0.92]],
    support_half: [[1.8, 0.92], [1.65, 0.76]],
    support_pulse: [[1.3, 0.94], [0.38, 0.65], [1.2, 0.86], [0.35, 0.65]],
    pop: [[0.85, 0.98], [0.4, 0.66], [0.8, 0.88], [0.28, 0.64], [0.34, 0.92]],
    dance: [[0.42, 0.98], [0.18, 0.56], [0.38, 0.78], [0.2, 0.55], [0.42, 0.92], [0.18, 0.58], [0.35, 0.76], [0.2, 0.68]],
    chill: [[1.25, 0.9], [0.55, 0.58], [0.3, 0.68], [0.8, 0.8]],
    jazz: [[0.84, 0.88], [0.48, 0.66], [0.84, 0.82], [0.48, 0.7]],
    offbeat: [[0.36, 0.9], [0.18, 0.62], [0.36, 0.86], [0.18, 0.68]],
    off: [],
  }
  const dynamics = articulation[/** @type {keyof typeof articulation} */ (genre)] ?? articulation.pop
  return pulses.map((pulse, index) => ({
    pulse,
    duration: dynamics[index][0],
    velocity: dynamics[index][1],
    tone: 'root',
    midi: root,
  }))
}

/** @param {ReturnType<typeof bassEvents>} events @param {string} feel */
export function bassFeelEvents(events, feel) {
  if (feel !== 'offbeat') return events
  return events.map(event => ({ ...event, pulse: (event.pulse + 1) % 8 })).sort((a, b) => a.pulse - b.pulse)
}

/** Select optional chord tones after the opening root; absent chord tones fall back to root.
 * @param {number} index @param {readonly string[]} selected @param {readonly number[]} chordNotes */
export function bassToneOffset(index, selected, chordNotes) {
  if (index % 2 === 0 || !selected.length || !chordNotes.length) return 0
  const tone = selected[Math.floor(index / 2) % selected.length]
  if (tone === 'octave') return 12
  const pitches = new Set(chordNotes.map(note => ((note - chordNotes[0]) % 12 + 12) % 12))
  const candidates = tone === 'fifth' ? [7, 6, 8] : tone === 'third' ? [4, 3] : []
  return candidates.find(interval => pitches.has(interval)) ?? 0
}

/** @param {number} duration @param {number} velocity @param {number} length @param {number} dynamics */
export function bassArticulation(duration, velocity, length, dynamics) {
  const l = Math.max(0, Math.min(100, length)) / 50
  const d = Math.max(0, Math.min(100, dynamics)) / 50
  const lengthFactor = l <= 1 ? 0.5 + 0.5 * l : 1 + 0.8 * (l - 1)
  const intensity = d <= 1 ? 0.4 + 0.6 * d : 1 + 0.45 * (d - 1)
  return { duration: duration * lengthFactor, velocity: Math.max(0.15, Math.min(1, 0.8 + (velocity - 0.8) * intensity)) }
}

export class BassSynth {
  /** @param {import('./audio.js').Instrument} instrument */
  constructor(instrument) {
    this.instrument = instrument
  }
  timbre = 'electric'
  toneEdited = false
  oscillators = [{waveform:'sawtooth',octave:0,cent:0},{waveform:'off',octave:0,cent:0},{waveform:'off',octave:0,cent:0}]
  unisonCount = 1
  unisonDetune = 0
  pitchBend = 0
  modulation = 0
  lfo = { rate: 2.4, depth: 50, cutoff: false, pitch: false, waveform: 'sine' }
  toneSettings = { cutoff: 100, resonance: 1, filterType: /** @type {'lowpass'|'highpass'} */ ('lowpass'), amp: { attack: .005, decay: .7, sustain: .12, release: .12 }, filter: { attack: .005, decay: .18, sustain: .24, release: .12, amount: 1 } }
  volume = 0.5
  /** @param {number} value */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value))
    this.instrument.engine?.bass.setVolume(this.volume)
  }
  applyToneSettings() {
    this.toneEdited = true
    const tone = this.instrument.engine?.bass
    if (!tone) return
    tone.setLfo(this.lfo.rate, this.lfo.depth, this.lfo.cutoff, this.lfo.pitch, this.lfo.waveform)
    tone.toneSettings = this.toneSettings
    tone.applyToneSettings()
  }
  /** @param {number} value */
  setPitchBend(value) { this.pitchBend = value; this.instrument.engine?.bass.setPitchBend(value) }
  /** @param {number} value */
  setModulation(value) { this.modulation = value; this.instrument.engine?.bass.setModulation(value) }
  /** @param {number} midi @param {number} time @param {number} duration @param {number} [velocity] @param {number} [slideFrom] */
  playAt(midi, time, duration, velocity, slideFrom) {
    const tone = this.instrument.engine?.bass
    if (!tone) return
    tone.timbre = this.timbre
    tone.setPitchBend(this.pitchBend)
    tone.setModulation(this.modulation)
    tone.setLfo(this.lfo.rate, this.lfo.depth, this.lfo.cutoff, this.lfo.pitch, this.lfo.waveform)
    const { waveform, octave, cent: pitchCent } = this.oscillators[0]
    tone.oscillators = Array.from({ length: this.unisonCount }, (_, index) => ({
      waveform, octave,
      cent: pitchCent + (this.unisonCount === 1 ? 0 : this.unisonDetune * (2 * index / (this.unisonCount - 1) - 1)),
    }))
    tone.toneSettings = this.toneEdited ? this.toneSettings : undefined
    tone.setVolume(this.volume)
    tone.playAt(midi, time, duration, velocity, slideFrom)
  }
  silence() {
    this.instrument.engine?.bass.silence()
  }
}

/** Mix multiple independently muted and soloed parts at their normal levels.
 * @param {Array<{part: {setVolume(value: number): void}, volume: number}>} parts */
export function createPartMixer(parts) {
  const muted = parts.map(() => false)
  const soloed = parts.map(() => false)
  /** @param {number} index */
  function effectiveVolume(index) {
    return !muted[index] && (!soloed.some(Boolean) || soloed[index]) ? parts[index].volume : 0
  }
  function apply() {
    parts.forEach(({part}, index) => part.setVolume(effectiveVolume(index)))
  }
  return {
    effectiveVolume,
    /** @param {number} index @param {number} value */
    setVolume(index, value) { parts[index].volume = Math.max(0, Math.min(1, value)); apply() },
    /** @param {number} index */
    toggleMute(index) { muted[index] = !muted[index]; apply(); return muted[index] },
    /** @param {number} index */
    toggleSolo(index) { soloed[index] = !soloed[index]; apply(); return soloed[index] },
  }
}

// Distinct starting arrangements for browsing; legacy recipes stay loadable.
export const styleChoiceIds = Object.freeze([
  "vocal_sky",
  "vocal_room",
  "vocal_cut",
  "vocal_piano",
  "vocal_garage",
  "vocal_letter",
  "vocal_dance",
  "vocal_chip",
  "vocal_theatre",
  "pop",
  "parade_trance",
  "parade_shadow",
  "magic_satin",
  "newmusic_coast",
  "clear_horizon",
  "idol_prism",
  "piano_switch",
  "night_soul",
  "scene_paper",
  "scene_prism",
  "scene_margin",
  "scene_signal",
  "scene_shadow",
  "scene_clock",
  "scene_steel",
  "scene_dungeon",
  "scene_call",
  "jpop_ballad",
  "jpop_city",
  "novel_keys",
  "break_rock",
  "wordbeat",
  "vt_velvet",
  "vt_neon",
  "vt_phantom",
  "vt_moon",
  "vt_crown",
  "anime_rock",
  "anime_ballad",
  "idol_cute",
  "kpop_dance",
  "kpop_rnb",
  "game_rpg",
  "game_battle",
  "game_retro",
  "game_calm",
  "game_danmaku",
  "arc_shibuya",
  "arc_swing",
  "arc_cabaret",
  "arc_tech",
  "arc_pixel",
  "edm_nova",
  "edm_rain",
  "edm_float",
  "edm_glass",
  "edm_veil",
  "chill",
  "jazz",
  "garage",
  "dub"
])

/** Plan authored bass pulses, including support notes at harmony boundaries.
 * @param {string} bassPattern @param {number} bar @param {number} beatsPerBar
 * @param {Parameters<typeof bassFeelEvents>[1]} feel
 * @param {number[]} changeBeats @param {boolean} changesAtEnd
 */
export function planBassPattern(bassPattern, bar, beatsPerBar, feel, changeBeats, changesAtEnd) {
  const authoredBass = bassFeelEvents(bassEvents(bassPattern, 0, bar), feel)
  const bassPatternEvents = [...authoredBass, ...(beatsPerBar === 5 ? authoredBass.filter(event => event.pulse < 2).map(event => ({...event, pulse:event.pulse + 8})) : [])].filter(event => event.pulse < beatsPerBar * 2).sort((a,b) => a.pulse - b.pulse)
  if (bassPattern.startsWith('support_') || bassPattern.startsWith('line_')) {
    for (const beat of changeBeats) {
      const pulse = beat * 2
      if (!bassPatternEvents.some(event => event.pulse === pulse))
        bassPatternEvents.push({ pulse, duration: 1.5, velocity: 0.82, tone: 'root', midi: 0 })
    }
    const transitions = changeBeats.map(beat => beat * 2)
    if (changesAtEnd) transitions.push(beatsPerBar * 2)
    for (const boundary of bassPattern.startsWith('support_') ? transitions : []) {
      const fillPulse = boundary - 1
      if (fillPulse > 0 && !bassPatternEvents.some(event => Math.abs(event.pulse - fillPulse) < 1))
        bassPatternEvents.push({ pulse: fillPulse, duration: 0.32, velocity: 0.55, tone: 'fifth', midi: 0 })
      const lastPulse = boundary - 0.5
      if (bassPattern === 'support_pulse' && lastPulse > 0 && !bassPatternEvents.some(event => Math.abs(event.pulse - lastPulse) < 0.5))
        bassPatternEvents.push({ pulse: lastPulse, duration: 0.17, velocity: 0.48, tone: 'third', midi: 0 })
    }
    bassPatternEvents.sort((a, b) => a.pulse - b.pulse)
  }
  return bassPatternEvents
}

export const lfoWaveforms = /** @type {const} */ (['sine', 'triangle', 'sawtooth', 'square'])
export const lfoWaveformNames = ['サイン波', '三角波', 'ノコギリ波', '矩形波']

/** @param {string} waveform @param {number} phase */
export function lfoWaveValue(waveform, phase) {
  const p = ((phase % 1) + 1) % 1
  if (waveform === 'triangle') return 2 * Math.asin(Math.sin(2 * Math.PI * p)) / Math.PI
  if (waveform === 'sawtooth') return 2 * ((p + .5) % 1) - 1
  if (waveform === 'square') return p < .5 ? 1 : -1
  return Math.sin(p * 2 * Math.PI)
}
