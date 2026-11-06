/** Curated starting points, not a chart-frequency ranking or song transcriptions.
 * Degrees use the app's major-key reference, including slash-chord bass degrees.
 * @typedef {{bar: number, beat: number, chord: string}} PresetChange
 * @typedef {{id: string, name: string, group: string, family: string, description: string,
 * pattern: readonly string[], modulation: readonly number[], changes: readonly Readonly<PresetChange>[]}} ProgressionPreset
 */

export const presetGroups = Object.freeze([
  { id: '1', label: 'Iスタート', pitch: 0 },
  { id: '6', label: 'VIスタート', pitch: 9 },
  { id: '4', label: 'IVスタート', pitch: 5 },
  { id: '2', label: 'IIスタート', pitch: 2 },
  { id: '3', label: 'IIIスタート', pitch: 4 },
  { id: '5', label: 'Vスタート', pitch: 7 },
  { id: '7', label: 'VIIスタート', pitch: 11 },
  { id: 'b2', label: '♭IIスタート', pitch: 1 },
  { id: 'b3', label: '♭IIIスタート', pitch: 3 },
  { id: '#4', label: '♯IVスタート', pitch: 6 },
  { id: 'b6', label: '♭VIスタート', pitch: 8 },
  { id: 'b7', label: '♭VIIスタート', pitch: 10 },
].map((group) => Object.freeze(group)))

// Named voicings keep existing recipes, including the original royal preset.
// Other IDs follow music.js's validated chord format (root is zero-based).
const c = Object.freeze({
  I: 'C', IM7: 'CM7', I9: 'x:0:maj:maj9:0', I7: 'x:0:maj:7:0', I7b13: 'x:0:maj:b13:0', I13: 'x:0:maj:13:0',
  ii: 'Dm7', ii9: 'x:1:min:9:0', II7: 'x:1:maj:7:0', II9: 'x:1:maj:9:0',
  iii: 'Em7', III7: 'x:2:maj:7:0', IIIb9: 'x:2:maj:b9:0', IIIalt: 'x:2:maj:b9_b13:0',
  IV: 'F', IVM7: 'FM7', IV9: 'x:3:maj:maj9:0', iv6: 'x:3:min:6:0',
  V: 'G', V7: 'G7', V13: 'x:4:maj:13:0', Vsus: 'x:4:sus4:7:0',
  vi: 'Am7', vi9: 'x:5:min:9:0', VI7: 'x:5:maj:7:0',
  v: 'x:4:min:7:0', vii: 'Bm7b5', VonVII: 'x:6:slash:v_over_7:0',
  sharpIV: 'x:3:dim:7:1', blackadder: 'x:3:slash:iii_aug_sharp4:1', VII7: 'x:6:maj:7:0',
  bVII: 'x:6:maj:none:11', bVII7: 'x:6:maj:7:11',
  bVI: 'x:5:maj:maj7:11', bVIdim: 'x:5:dim:dim7:11',
  bII7: 'x:1:maj:7:11', bII9: 'x:1:maj:9:11',
  bIII: 'x:2:maj:maj7:11', bIIIdim: 'x:2:dim:dim7:11',
})

/** @param {string} id @param {string} group @param {string} family
 * @param {string} name @param {string} description @param {readonly string[]} pattern
 * @param {readonly PresetChange[]} [changes] @param {readonly number[]} [modulation] @returns {Readonly<ProgressionPreset>} */
function preset(id, group, family, name, description, pattern, changes = [], modulation = [0, 0, 0, 0]) {
  return Object.freeze({ id, group, family, name, description,
    pattern: Object.freeze([...pattern]),
    modulation: Object.freeze([...modulation]),
    changes: Object.freeze(changes.map((change) => Object.freeze({ ...change }))),
  })
}

export const presets = Object.freeze([
  preset('vt-starlight', '4', 'VTuberポップ', 'スターライト・サイン', '大きく開くサビに、歌う低音ときらめく単音を添えるよ。', [c.IVM7, c.V, c.iii, c.vi, c.ii, c.V, c.I, c.I]),
  preset('vt-velvet', '2', 'VTuberポップ', 'ベルベット・ナイト', '和音は短く、低音は深く。隙間があるほど歌が近くに感じられるよ。', [c.ii9, c.V13, c.I9, c.VI7, c.ii9, c.bII7, c.I9, c.III7]),
  preset('vt-comet', '6', 'VTuberポップ', 'コメット・ランナー', '走るバンドの中で、最後のドミナントが短調への帰り道をつくるよ。', [c.vi, c.IV, c.I, c.V, c.vi, c.ii, c.III7, c.vi]),
  preset('vt-sugar', '1', 'VTuberポップ', 'シュガー・ログイン', '細かな合いの手と明るい寄り道で、呼びかけに返事したくなる音だよ。', [c.I, c.VI7, c.ii, c.V, c.iii, c.VI7, c.ii, c.V7]),
  preset('vt-orbit', '6', 'VTuberポップ', 'オービット・ドロップ', '裏拍の低音と広い和音で、浮かび上がるダンスの足場をつくるよ。', [c.vi, c.IV, c.I, c.V, c.vi, c.IV, c.ii, c.Vsus]),
  preset('vt-letter', '1', 'VTuberポップ', 'アンコールの手紙', '明るい四度がふっと曇ると、いつもの帰り道が少し切なくなるよ。', [c.IM7, c.iii, c.IVM7, c.iv6, c.IM7, c.VI7, c.ii, c.V13]),
  preset('vt-neon', '4', 'VTuberポップ', 'ネオン・ルーレット', '短調へ引き寄せる和音と細かなカッティングで、夜を軽やかに踊るよ。', [c.IV9, c.III7, c.vi9, c.v, c.IV9, c.bIIIdim, c.ii9, c.V13], [{ bar: 3, beat: 2, chord: c.I7 }, { bar: 7, beat: 3, chord: c.bII7 }]),
  preset('vt-phantom', '3', 'VTuberポップ', 'ファントム・ショー', '半音の寄り道と途切れるビートで、舞台の表と裏を行き来するよ。', [c.iii, c.IIIb9, c.vi, c.VI7, c.ii9, c.bII7, c.IM7, c.IIIalt], [{ bar: 3, beat: 3, chord: c.bVIdim }, { bar: 7, beat: 2, chord: c.IIIb9 }]),
  preset('vt-soda', '1', 'VTuberポップ', 'ソーダ・ホリデイ', '軽い十六分と循環する和音が、肩の力を抜いた休日をつくるよ。', [c.I9, c.VI7, c.ii9, c.V13, c.iii, c.vi, c.ii9, c.V13]),
  preset('vt-moon', '6', 'VTuberポップ', 'ムーンライト・ルーム', 'ゆっくり揺れる低音に、余韻を残す和音。短調の中にも柔らかい光があるよ。', [c.vi9, c.iii, c.IVM7, c.IM7, c.ii9, c.IIIb9, c.vi9, c.vi]),
  preset('vt-spark', '2', 'VTuberポップ', 'スパーク・チェイサー', '細かく割れたドラムに、遠い和音が次々と景色を変えていくよ。', [c.ii, c.bVII, c.bIII, c.iii, c.IV, c.bII9, c.Vsus, c.V7]),
  preset('vt-prism', '4', 'VTuberポップ', 'プリズム・ジャンプ', '小節の途中で和音を渡し、後半だけ光の角度を変えるよ。', [c.IV9, c.iii, c.vi9, c.v, c.I9, c.IV9, c.ii9, c.V13], [{ bar: 1, beat: 2, chord: c.bVIdim }, { bar: 5, beat: 2, chord: c.III7 }], [0, 0, 3, -3]),
  preset('vt-crown', '1', 'VTuberポップ', 'クラウン・マーチ', '歩く低音に劇場の和音。明るさと陰りが交互に顔を出すよ。', [c.I, c.III7, c.vi, c.I7, c.IVM7, c.iv6, c.I, c.Vsus]),
  preset('vt-horizon', '6', 'VTuberポップ', 'ホライズン・コール', '広がる和音とまっすぐなビートで、後半のサビを一段持ち上げるよ。', [c.vi, c.IVM7, c.ii, c.V, c.vi, c.IV, c.ii, c.V7], [], [0, 0, 2, -2]),
  preset('vt-afterglow', '2', 'VTuberポップ', '配信後のアフターグロウ', '柔らかなコンピングに借用和音をひとつ。終わっても余韻の続く進行だよ。', [c.ii9, c.V13, c.IM7, c.VI7, c.IV9, c.iv6, c.iii, c.VI7]),
  preset('vocal-sky', '4', 'ボカロ', 'コネクト・スカイ', '開けた和音と四つ打ちの上で、分散音が光をつなぐよ。', [c.IVM7, c.V, c.iii, c.vi, c.IVM7, c.V, c.IM7, c.IM7]),
  preset('vocal-room', '1', 'ボカロ', 'ワンルーム・アンテナ', '小さく跳ねる低音に、柔らかい和音が返事をするよ。', [c.IM7, c.iii, c.IVM7, c.V, c.IM7, c.VI7, c.ii, c.V13]),
  preset('vocal-cut', '2', 'ボカロ', 'ピクセル・コラージュ', '途切れるリズムと細かな音の受け渡しで、反復にいたずらを仕込むよ。', [c.ii9, c.V13, c.I9, c.VI7, c.IV9, c.bIIIdim, c.ii9, c.V13], [{ bar: 3, beat: 2, chord: c.III7 }, { bar: 7, beat: 2, chord: c.VI7 }]),
  preset('vocal-piano', '6', 'ボカロ', '午前零時のタイプライター', '駆けるピアノの隙間で、低音が次の和音へ歌っていくよ。', [c.vi, c.IV, c.I, c.V, c.vi, c.ii, c.III7, c.vi]),
  preset('vocal-garage', '1', 'ボカロ', '放課後ガレージ', '素直な三和音を短くかき鳴らす、背伸びしないバンドの音だよ。', [c.I, c.V, c.vi, c.IV, c.I, c.IV, c.V, c.I]),
  preset('vocal-letter', '6', 'ボカロ', '六畳半のラブレター', 'ためらうような短調から、明るい和音へ少しだけ顔を上げるよ。', [c.vi, c.iii, c.IV, c.I, c.ii, c.III7, c.vi, c.V]),
  preset('vocal-dance', '4', 'ボカロ', 'ネオン逃避行', '裏で切る和音と跳ねるオクターブが、短調を踊らせるよ。', [c.IVM7, c.III7, c.vi, c.v, c.IVM7, c.V, c.iii, c.VI7]),
  preset('vocal-chip', '1', 'ボカロ', 'ポケットの流星群', '小さな電子音のリフに、借りてきた和音が一瞬だけ違う色を添えるよ。', [c.I, c.VI7, c.ii, c.V, c.I, c.bIII, c.IV, c.V]),
  preset('vocal-theatre', '3', 'ボカロ', 'からくり夜行', '半音の寄り道と短い和音で、舞台の照明が切り替わるように進むよ。', [c.iii, c.III7, c.vi, c.VI7, c.ii9, c.bII7, c.IM7, c.IIIb9]),
  preset('vocal-rocket', '6', 'ボカロ', '透明ロケット', '走る八分の上で、後半だけ景色を持ち上げ、元の場所へ帰るよ。', [c.vi, c.IV, c.V, c.I, c.vi, c.IV, c.ii, c.V], [], [0, 0, 2, -2]),
  preset('glove', '6', '洋楽ポップ', '街灯のムーンステップ', '短調のリフに戻るたび、裏で刻む和音がくっきり浮かぶよ。', [c.vi, c.vi, c.ii9, c.vi, c.vi, c.IV9, c.ii9, c.III7]),
  preset('mirror', '2', '洋楽ポップ', 'ミラー・ブギー', '跳ね上がる低音の上で、最後の長三和音が次の周回を呼び込むよ。', [c.ii9, c.V13, c.iii, c.vi9, c.ii9, c.V13, c.I9, c.VI7]),
  preset('radio', '1', '洋楽ポップ', 'ラジオの帰り道', '明るい4を短く曇らせると、帰ってきた1が懐かしく響くね。', [c.I9, c.iii, c.IV9, c.iv6, c.I9, c.VI7, c.ii9, c.V13]),
  preset('hammer', '6', '洋楽ロック', '鉄橋のストンプ', '低音のリフに、大きく張った和音が合いの手を返すよ。', [c.vi, c.vi, c.bVII, c.IV, c.vi, c.bIII, c.IV, c.vi]),
  preset('orbit', '2', '洋楽ロック', '軌道上の残響', '同じ和音に二小節とどまると、分散した音の余韻が広がるよ。', [c.ii9, c.ii9, c.IV9, c.IV9, c.ii9, c.v, c.I9, c.ii9]),
  preset('ballroom', '1', 'ジャズ', '1930s・真鍮のダンスホール', 'ベースが歩く上で、1から6、2、5と回ってダンスが続くよ。', [c.I, c.VI7, c.ii, c.V7, c.I, c.VI7, c.ii, c.V7]),
  preset('alley', '3', 'ジャズ', '1940s・路地裏のビバップ', '次の和音へ五度ずつ着地。最後の6⁷がもう一度流れを押し出すよ。', [c.iii, c.VI7, c.ii, c.V7, c.I9, c.III7, c.vi, c.VI7]),
  preset('blueglass', '2', 'ジャズ', '1950s末・青いモード', '和音を据えたまま二小節だけ半音上へ。同じフレーズで景色が変わるよ。', [c.ii9, c.ii9, c.ii9, c.ii9, c.ii9, c.ii9, c.ii9, c.ii9], [], [0,0,1,0]),
  preset('socket', '2', 'ジャズ', '1970s・電気回路のファンク', '短いエレピの返事とベースの反復がかみ合って、後半で景色が開くよ。', [c.ii9, c.I13, c.ii9, c.I13, c.IV9, c.iii, c.ii9, c.V13]),
  preset('paperstar', '6', '同人音楽', '星図の余白', '途切れた拍の向こうで、4の明暗がそっと入れ替わるよ。', [c.vi9, c.iii, c.IV9, c.iv6, c.I9, c.bIII, c.ii9, c.IIIalt]),
  preset('spool', '1', '同人音楽', '糸巻きの小劇場', '低音が半音でせり上がる瞬間、明るい舞台に影が差すよ。', [c.I9, c.sharpIV, c.iii, c.VI7, c.ii9, c.iv6, c.I9, c.V7]),
  preset('signal', '4', 'アニソン', '放課後の発射台', 'サビを押し上げる4と5の後で、3⁷が短調へぐっと引き寄せるよ。', [c.IV, c.V, c.iii, c.vi, c.ii, c.III7, c.vi, c.v]),
  preset('prismbell', '1', 'アニソン', '変身前の一秒', '出だしのベースが階段を降りて、歌が入る場所を作るよ。', [c.IM7, c.VonVII, c.vi9, c.III7, c.IV9, c.iv6, c.ii9, c.V13]),
  preset('bitgate', '6', '音楽ゲーム', 'ビット・ゲート', '高速の反復を突き抜けて、最後の二小節で短調に着地！', [c.vi, c.bVII, c.I, c.VI7, c.ii9, c.V13, c.IIIalt, c.vi]),
  preset('nightlane', '2', '音楽ゲーム', '深夜の判定線', '抜けたキックの隙間を鍵盤が走り、明るい着地から借用和音へ跳ぶよ。', [c.ii9, c.V13, c.I9, c.bIII, c.IV9, c.III7, c.vi, c.VI7]),
  preset('parade-trance', '6', '幻想エレクトロ', '閉幕の向こう側', '6mから下降する低音。後半は平行長調へ開き、短9度のドミナントで短調に戻る。', [c.vi,c.VonVII,c.IM7,c.IIIb9,c.IV9,c.V13,c.vii,c.IIIalt], [{bar: 1, beat: 3, chord: c.III7}, {bar: 3, beat: 2, chord: c.vi}, {bar: 7, beat: 2, chord: c.IIIb9}]),
  preset('parade-shadow', '3', '幻想エレクトロ', '鏡の回転木馬', '3mの小さな反復と4m6の半音。2m→5⁷を足場に、5〜6小節だけ半音下の長調へ入り、7ø→3⁷で帰る。', [c.iii,c.iv6,c.ii9,c.V7,c.I9,c.IV9,c.vii,c.IIIb9], [{bar: 1, beat: 2, chord: c.iii}, {bar: 3, beat: 3, chord: 'x:3:maj:7:1'}, {bar: 5, beat: 2, chord: c.iv6}], [0,0,-1,0]),
  preset('magic-satin', '1', 'きらめきポップ', 'サテンの変身コンパクト', '長9度と下降低音、半音の経過和音で軽く跳ねる。借用の4m6を挟み、最後は一拍ずつ回って次の1へ。', [c.I9,c.VonVII,c.vi9,c.III7,c.IV9,c.sharpIV,c.iii,c.VI7], [{bar: 2, beat: 3, chord: c.VI7}, {bar: 4, beat: 2, chord: c.iv6}, {bar: 7, beat: 1, chord: c.ii9}, {bar: 7, beat: 2, chord: c.Vsus}, {bar: 7, beat: 3, chord: c.V13}]),
  preset('magic-prism', '4', 'きらめきポップ', '虹色のチャンネル', '3m7から♭3dim7へ半音で降り、2m9とドミナントを経て戻る。', [c.IV9,c.ii9,c.I9,c.ii9,c.IVM7,c.iv6,c.iii,c.ii9], [{bar: 1, beat: 3, chord: c.bVII7}, {bar: 3, beat: 2, chord: c.V13}, {bar: 3, beat: 3, chord: c.VI7}, {bar: 6, beat: 2, chord: c.bIIIdim}, {bar: 7, beat: 2, chord: c.I7b13}, {bar: 7, beat: 3, chord: c.V7}], [0,3,0,0]),
  preset('newmusic-coast', '1', 'ニューミュージック', '海沿いの下降線', '1△9→5/7→6m9と低音を降ろす。4△9から4m6の半音を聴かせ、後半は6⁷→2m9→5¹³で帰る。', [c.I9,c.VonVII,c.vi9,c.IV9,c.iv6,c.iii,c.ii9,c.V13], [{bar: 2, beat: 2, chord: c.v}, {bar: 2, beat: 3, chord: c.I7}, {bar: 5, beat: 2, chord: c.VI7}, {bar: 7, beat: 2, chord: c.Vsus}]),
  preset('newmusic-rain', '1', 'ニューミュージック', '雨の窓辺の借用和音', '長9度の静かな出だし。3⁷から6m9へ寄り、4m6と♭7⁷の柔らかいバックドアで1へ着地する。', [c.I9,c.III7,c.vi9,c.v,c.IV9,c.iv6,c.bVII7,c.I9], [{bar: 3, beat: 2, chord: c.I7}, {bar: 7, beat: 3, chord: c.Vsus}]),
  preset('clear-horizon', '1', 'ニューミュージック', '水平線のサスペンド', '1add9と下降低音から、4の明るい余白へ。5〜6小節は2m→5⁷を入口に全音上へ広がり、共通和音2mから元の5へ。', ['x:0:maj:add9:0',c.VonVII,c.vi,c.ii,c.I9,c.IVM7,c.ii9,c.Vsus], [{bar: 3, beat: 2, chord: c.V7}, {bar: 3, beat: 3, chord: c.VI7}, {bar: 7, beat: 2, chord: c.V7}], [0,0,2,0]),
  preset('clear-letter', '1', 'ニューミュージック', '便箋の余白', '1add9、6m7、4△7をゆっくり歌わせる。4m6の内声が半音でほどけ、最後にsusが解ける。', ['x:0:maj:add9:0',c.VonVII,c.vi,c.IVM7,c.ii9,c.iv6,'x:0:maj:add9:0',c.Vsus], [{bar: 7, beat: 2, chord: c.V7}]),

  preset('edm-nova', '6', 'EDM・同人エレクトロ', 'ノヴァの断層', '6mのペダルを半音の借用和音で裂き、後半はドミナントを連打する。', [c.vi, c.vi, c.bVI, c.Vsus, c.vi, c.bII7, c.vii, c.IIIalt], [{ bar: 1, beat: 3, chord: c.bVII }, { bar: 5, beat: 2, chord: c.III7 }, { bar: 7, beat: 2, chord: c.IIIb9 }, { bar: 7, beat: 3, chord: c.III7 }], [0,0,0,0]),
  preset('edm-warp', '6', 'EDM・同人エレクトロ', 'ワープの反転', '短調を駆け抜け、後半だけ半音上へ。4拍の連続コードから元のキーへ戻る。', [c.vi, c.IV, c.ii, c.III7, c.vi, c.bVII, c.IV, c.IIIalt], [{ bar: 3, beat: 1, chord: c.vi }, { bar: 3, beat: 2, chord: c.IV }, { bar: 3, beat: 3, chord: c.III7 }], [0,0,1,0]),
  preset('edm-rain', '2', 'EDM・同人エレクトロ', '雨粒の屈折', '2m9から5¹³へ進み、下降する低音と6⁷(♭13)を経て、柔らかな長9度へ。', [c.ii9,c.V13,c.I9,c.vi9,c.ii9,c.V7,c.IV9,c.I9], [{ bar: 2, beat: 3, chord: c.VonVII }, { bar: 3, beat: 2, chord: 'x:5:maj:b13:0' }, { bar: 5, beat: 3, chord: c.III7 }], [0,0,0,0]),
  preset('edm-float', '4', 'EDM・同人エレクトロ', '浮遊するシャボン', '4△9と1△9の空間に、♭3と♭6が別の光を差し込む。', [c.IV9,c.I9,c.bIII,c.Vsus,c.IV9,c.bVI,c.ii9,c.V13], [{ bar: 3, beat: 3, chord: c.V7 }], [0,0,0,0]),
  preset('edm-glass', '2', 'EDM・同人エレクトロ', '硝子の回廊', '2m9から五度で歩き、短3度上の部屋を二小節だけ通過する。', [c.ii9,c.V13,c.I9,c.IV9,c.ii9,c.V13,c.iii,c.VI7], [{ bar: 7, beat: 2, chord: c.bII7 }], [0,0,3,-3]),
  preset('edm-owl', '1', 'EDM・同人エレクトロ', '夜会の寄り道', '6度を足した明るい和音から、半音のディミニッシュとセカンダリードミナントで踊る。', [c.I,c.sharpIV,c.ii,c.V7,c.IM7,c.VI7,c.ii9,c.IM7], [{ bar: 0, beat: 2, chord: c.I13 }, { bar: 2, beat: 2, chord: c.II7 }, { bar: 6, beat: 2, chord: c.bII7 }], [0,0,0,0]),
  preset('edm-voyage', '6', 'EDM・同人エレクトロ', '星間のアルペジオ', '6mから4、1、5へ広がる素直な循環を、16分アルペジオで描く。', [c.vi,c.IV,c.I,c.V,c.vi,c.IVM7,c.ii,c.Vsus], [], [0,0,0,0]),
  preset('edm-motor', '1', 'EDM・同人エレクトロ', 'モーターの循環', '1と4の明るいファンクに、後半の2⁷と5¹³で回転を加える。', [c.IM7,c.IV9,c.iii,c.VI7,c.ii9,c.II7,c.V13,c.V13], [{ bar: 7, beat: 3, chord: c.bII7 }], [0,0,0,0]),
  preset('edm-aria', '3', 'EDM・同人エレクトロ', 'アルカディアの扉', '3mから五度で巡り、4m6の内声と転調で旋律を大きく持ち上げる。', [c.iii,c.VI7,c.ii9,c.V13,c.I9,c.iv6,c.ii9,c.Vsus], [{ bar: 3, beat: 2, chord: c.III7 }, { bar: 7, beat: 2, chord: c.V7 }], [0,0,2,-2]),
  preset('edm-confetti', '1', 'EDM・同人エレクトロ', '紙吹雪の四拍ターン', '明るい1から借用の♭3へ飛び、終端の4拍で連続ドミナントを浴びせる。', [c.I,c.bIII,c.IV,c.V,c.vi,c.IV,c.ii,c.V7], [{ bar: 7, beat: 1, chord: c.III7 }, { bar: 7, beat: 2, chord: c.VI7 }, { bar: 7, beat: 3, chord: c.V7 }], [0,0,0,0]),
  preset('edm-veil', '6', 'EDM・同人エレクトロ', '霧の残響', '6m9の余韻を4m6と♭6で曇らせ、後半は半音上の空間へ滲む。', [c.vi9,c.iv6,c.bVI,c.Vsus,c.vi9,c.IV9,c.vii,c.IIIb9], [{ bar: 3, beat: 3, chord: c.IIIalt }], [0,0,1,0]),
  preset('edm-ritual', '6', 'EDM・同人エレクトロ', '深紅の儀式', '6mの暗い足場から7øと3⁷へ。半音のディミニッシュが反復を断ち切る。', [c.vi,c.vii,c.IIIb9,c.vi,c.bVI,c.bVIdim,c.vii,c.IIIalt], [{ bar: 1, beat: 2, chord: c.III7 }, { bar: 5, beat: 3, chord: c.IIIb9 }], [0,0,0,0]),
  preset('sparkle-stage', '4', 'アイドル', 'スパークルの上昇', '4から5、6mへ上がり、6⁷sus4から次の周へ。', [c.IVM7, c.V, c.vi, c.I, c.IVM7, c.V, 'x:5:sus4:7:0', c.VI7]),
  preset('last-scene-idol', '4', 'アイドル', 'ラストシーンの余韻', '4△9から3mへ降り、♭6dim7を挟んで6m9へ向かう。', [c.IV9, c.V13, c.iii, c.vi9, c.ii9, c.V13, c.IIIb9, c.vi9], [{ bar: 2, beat: 3, chord: c.bVIdim }]),
  preset('slow-motion', '6', 'K-POP', 'スロウ・モーションの反復', '6m9と4△9を長く重ね、最後の3⁷で次の周へ。', [c.vi9, c.vi9, c.IV9, c.IV9, c.vi9, c.vi9, c.IV9, 'x:2:maj:s9_b13:0']),
  preset('royal', '4', '王道・4536', '王道進行', 'まずはここから。4→5→3→6の基本形。', [c.IVM7, c.V, c.iii, c.vi]),
  preset('idol-prism', '4', 'アニソン', '放課後のプリズム', '4△9から3m7へ降り、ディミニッシュを経て、5〜6小節は短3度上のキーへ。', [c.IV9, c.iii, c.vi9, c.v, c.I9, c.IV9, c.ii9, c.V13], [
    { bar: 1, beat: 2, chord: c.bVIdim }, { bar: 3, beat: 2, chord: c.blackadder },
    { bar: 5, beat: 2, chord: c.III7 }, { bar: 7, beat: 3, chord: c.I7 },
  ], [0, 0, 3, 0]),
  preset('piano-switch', '2', 'J-POP', '鍵盤の四拍ターン', '2m9と5¹³から始まり、全音上へ転じて戻る。裏コードと6⁷sus4で次の周へ。', [c.ii9, c.I9, c.ii9, c.VI7, c.ii9, c.bII7, c.IM7, 'x:5:sus4:7:0'], [
    { bar: 0, beat: 2, chord: c.V13 }, { bar: 1, beat: 2, chord: c.III7 },
    { bar: 5, beat: 2, chord: c.V7 }, { bar: 7, beat: 2, chord: c.VI7 },
  ], [0, 2, 0, 0]),
  preset('summer-lift', '1', 'J-POP', '青空の全音リフト', '1から4へ大きく開き、5〜6小節で同じ景色を全音上に描き直す。', [c.I, c.IV, c.vi, c.V, c.I, c.IV, c.ii, c.Vsus], [{ bar: 3, beat: 3, chord: c.VI7 }, { bar: 7, beat: 2, chord: c.V7 }], [0, 0, 2, 0]),
  preset('night-soul', '1', 'J-POP', '夜更けのソウル循環', '長9度をゆっくり伸ばし、4m6の内声と裏拍のベースで1へ帰る。', [c.I9, c.iii, c.IV9, c.iv6, c.I9, c.VI7, c.ii9, c.V13], [{ bar: 7, beat: 2, chord: c.Vsus }]),
  preset('scene-paper', '2', '同人音楽', '内声の半音', '2m9から1△9、6m7へ進み、4m6を経て2m9と5¹³へ。', [c.ii9, c.I9, c.vi, c.iv6, c.iii, c.VI7, c.ii9, c.V13], [{ bar: 1, beat: 3, chord: c.VonVII }]),
  preset('scene-prism', '1', '同人音楽', '硝子の屈折', '1の明るい長9度から♭3へ横滑り。後半は同じ出発点から♭6へ向かう。', [c.I9, c.bIII, c.ii9, c.Vsus, c.I9, c.bVI, c.iv6, c.Vsus], [{ bar: 7, beat: 3, chord: c.V7 }]),
  preset('scene-margin', '4', '同人音楽', '夕暮れの借用和音', '4から3、2へと降り、3⁷の短9度で6mへ引き寄せ、5の上の4で戻る。', [c.IV9, c.iii, c.ii9, c.IIIb9, c.vi9, c.I7, c.IV9, 'x:4:slash:iv_over_v:0'], [{ bar: 5, beat: 2, chord: c.v }]),
  preset('scene-signal', '6', '幻想エレクトロ', '点滅する短調', '短調の同じ足場を反復し、後半だけ借用した4m6で足元の色を変える。', [c.vi, c.vi, c.bVII, c.III7, c.vi, c.iv6, c.vii, c.IIIb9], [{ bar: 1, beat: 3, chord: c.bII7 }]),
  preset('scene-shadow', '3', '幻想エレクトロ', '半音の影絵', '3mの反復に4と4mを重ねる。後半は3から♭3へ沈む。', [c.iii, c.iii, c.IV9, c.iv6, c.iii, c.bIII, c.vii, c.IIIb9], [{ bar: 3, beat: 3, chord: c.ii9 }]),
  preset('scene-clock', 'b2', '幻想エレクトロ', 'ずれた歯車', '♭2と1の半音を二度繰り返し、4m6を経て違う帰り道を作る。', [c.bII7, c.I9, c.bII7, c.I9, c.IV9, c.iv6, c.bII7, c.Vsus], [{ bar: 6, beat: 3, chord: c.V7 }]),
  preset('scene-blue', '6', 'PCゲーム音楽', '青空のロングトーン', '6m9を保ち、2m9と3⁷の緊張を経て、最後はディミニッシュで戻る。', [c.vi9, c.vi9, c.IV9, c.ii9, c.vi9, c.iii, c.IV9, c.Vsus], [{ bar: 3, beat: 2, chord: 'x:2:maj:s9_b13:0' }, { bar: 7, beat: 2, chord: 'x:2:maj:s9_b13:0' }, { bar: 7, beat: 3, chord: c.bVIdim }]),
  preset('scene-night', '2', 'PCゲーム音楽', '夜明けの連続ドミナント', '2mから3⁷で駆け上がり、6mに着地。後半の2⁷と3⁷で次へ走る。', [c.ii, c.III7, c.vi, c.V, c.IV, c.II7, c.Vsus, c.III7], [{ bar: 3, beat: 3, chord: c.I7 }]),
  preset('scene-steel', '6', 'PCゲーム音楽', '鋼のペダル', '6mの連打を♭7で断ち、7øと3⁷の緊張を挟んで駆け抜ける。', [c.vi, c.vi, c.bVII, c.vii, c.vi, c.vi, c.bVII, c.v], [{ bar: 3, beat: 2, chord: 'x:2:maj:s9_b13:0' }, { bar: 7, beat: 2, chord: c.III7 }]),
  preset('scene-dungeon', '3', 'PCゲーム音楽', '迷宮の五度連鎖', '3mから6⁷、2m9へ五度で進み、後半は♭3dim7と♯4で迷路を曲がる。', [c.iii, c.VI7, c.ii9, c.V13, c.iii, c.bIIIdim, c.sharpIV, c.vii], [{ bar: 7, beat: 2, chord: c.III7 }]),
  preset('scene-call', '1', '電波・アキバポップ', '合いの手の空白', '1から6⁷、2m、5⁷へ。後半の♭3と♭6が色を変える。', [c.I, c.VI7, c.ii, c.V7, c.I, c.bIII, 'x:5:maj:maj9:11', c.Vsus], [{ bar: 7, beat: 2, chord: c.V7 }]),
  preset('scene-toybox', '4', '電波・アキバポップ', 'おもちゃ箱の受け渡し', '4から2⁷で5へ飛び、6⁷が2mへバトンを渡す。最後は1⁹で4へ戻る。', [c.IV, c.II7, c.V, c.VI7, c.ii, c.V7, c.I, 'x:0:maj:9:0']),
  preset('scene-march', '1', '電波・アキバポップ', '行進の寄り道', '1からベースが7、6へ降り、4m6と5augで次の周へ。', [c.I, c.VonVII, c.vi, c.III7, c.IV, c.iv6, c.I, c.V7], [{ bar: 7, beat: 2, chord: 'x:4:aug:none:0' }]),
  preset('full-throttle-rock', '4', 'アニソン', 'フルスロットルの展開', '王道から2m7へ進み、3⁷の鋭い響きと5m7を経て1⁷sus4で戻る。', [c.IVM7, c.V7, c.iii, c.vi, c.ii, 'x:2:maj:s9_b13:0', c.v, 'x:0:sus4:7:0']),
  preset('royal-seventh', '4', '王道・4536', '王道 · 5を7thに', '5のドミナントで動きを強める。 後半は3⁷で6mへの引力を強める。', [c.IVM7, c.V7, c.iii, c.vi, c.IVM7, c.V7, c.III7, c.vi]),
  preset('royal-dominant', '4', '王道・4536', '王道 · 3を7thに', '3⁷から6mへの引力を加えた変化形。 後半は2mから再び6mへ向かう。', [c.IVM7, c.V7, c.III7, c.vi, c.ii, c.V7, c.III7, c.vi]),
  preset('royal-colour', '4', '王道・4536', '王道 · 9th / 13th', '同じ4536に近接したテンションの彩り。 後半は2m9から3⁷(♭9)へ色を変える。', [c.IV9, c.V13, c.iii, c.vi9, c.ii9, c.V13, c.IIIb9, c.vi9]),
  preset('royal-passing', '4', '王道・4536', '王道 · 4拍目の経過和音', '4の4拍目に♯4ø、3mの4拍目に3⁷を挟んで次へつなぐ。', [c.IVM7, c.V, c.iii, c.vi], [{ bar: 0, beat: 3, chord: c.sharpIV }, { bar: 2, beat: 3, chord: c.III7 }]),
  preset('royal-turn', '4', '王道・4536', '王道 · 最後に2→5', '最後の小節を6m→2m→5⁷と動かし、次の4へ戻る。', [c.IVM7, c.V, c.iii, c.vi], [{ bar: 3, beat: 2, chord: c.ii }, { bar: 3, beat: 3, chord: c.V7 }]),
  preset('lift-456', '4', '456・上昇', '456 · 6にとどまる', '4→5→6の上昇を、6で一息ついて繰り返す。', [c.IVM7, c.V, c.vi, c.vi]),
  preset('lift-4565', '4', '456・上昇', '4565 · 折り返す', '6から5へ戻り、次の4へつなぐ。 後半は3⁷を挟んで6mの余韻を作る。', [c.IVM7, c.V, c.vi, c.V, c.IVM7, c.V, c.vi, c.III7]),
  preset('lift-4561', '4', '456・上昇', '4561 · 明るく開く', '上昇したあと1へ着地する基本形。 後半は王道の4536へ展開する。', [c.IVM7, c.V, c.vi, c.I, c.IVM7, c.V, c.iii, c.vi]),
  preset('lift-4563', '4', '456・上昇', '4563 · 余韻を残す', '最後の3mで長調と短調の間を漂う。 後半は2mから入り、6mへ向かう。', [c.IVM7, c.V, c.vi, c.iii, c.ii, c.V, c.iii, c.vi]),
  preset('lift-456-pickup', '4', '456・上昇', '456 · 5から6へひと押し', '2小節目の4拍目に3⁷を置き、6mへ引き寄せる。 後半は4536へ展開する。', [c.IVM7, c.V, c.vi, c.I, c.IVM7, c.V, c.iii, c.vi], [{ bar: 1, beat: 3, chord: c.III7 }]),
  preset('game-danmaku-lift', '4', 'ゲーム・短調の上昇', 'ゲーム · 4→5→6mの上昇', '短調の♭VI→♭VII→iにあたる上昇。後半は3⁷を経由して短調へ戻る。', [c.IVM7, c.V, c.vi, c.vi, c.IVM7, c.V, c.III7, c.vi], [{ bar: 1, beat: 3, chord: c.III7 }]),
  preset('game-danmaku-passing', '4', 'ゲーム・短調の上昇', 'ゲーム · 4→5→3⁷→6m', '4→5の上昇から3⁷で6mへ。後半は7ø→3⁷で次の4へ緊張を残す。', [c.IVM7, c.V, c.III7, c.vi, c.IVM7, c.V, c.vii, c.III7], [{ bar: 0, beat: 3, chord: c.sharpIV }, { bar: 3, beat: 3, chord: c.I7 }]),
  preset('four-one-five-six', '4', '4コード・4156', '4156 · 4から広がる', '4→1→5→6。明るさを保ちながら6mへ向かう。 後半は2m→5⁷へ展開する。', [c.IV, c.I, c.V, c.vi, c.IVM7, c.I, c.ii, c.V7]),
  preset('marusa', '4', '丸サ・436', '丸サ · 4→3⁷→6→1⁷', '3⁷で6mへ、1⁷で4へ戻る丸サ系の基本形。 後半は4の代わりに2mから入る。', [c.IVM7, c.III7, c.vi, c.I7, c.ii, c.III7, c.vi, c.I7]),
  preset('marusa-turnaround', '4', '丸サ・436', '丸サ · 終わりに5m→1⁷', '4小節目の3拍目に1⁷を置き、次の4へ。', [c.IVM7, c.III7, c.vi, c.v], [{ bar: 3, beat: 2, chord: c.I7 }]),
  preset('marusa-passing', '4', '丸サ・436', '丸サ · 3拍目に5m→1⁷', '6mの後半で5m→1⁷と進み、4へ戻る流れを先取り。', [c.IVM7, c.III7, c.vi, c.IVM7], [{ bar: 2, beat: 2, chord: c.v }, { bar: 2, beat: 3, chord: c.I7 }]),
  preset('marusa-colour', '4', '丸サ・436', '丸サ · 9th / ♭9 / 13th', '丸サ系をテンションで色づけした変化形。 後半は2m9から入る。', [c.IV9, c.IIIb9, c.vi9, c.I13, c.ii9, c.IIIb9, c.vi9, c.I13]),
  preset('iv-minor', '4', '借用・マイナー4', '4→4m→1→6', '長調の4から借用した4mへ、半音の陰影。 後半は2→5から1⁷を経て4へ戻る。', [c.IVM7, c.iv6, c.IM7, c.vi, c.ii, c.V7, c.IM7, c.I7]),

  preset('two-royal', '2', '王道の2始まり・2536', '2536 · 王道の入口を2に', '4の代わりに2mから入る、王道の近縁形。 後半は4から展開し6⁷で2mへ戻る。', [c.ii, c.V, c.iii, c.vi, c.IVM7, c.V, c.iii, c.VI7]),
  preset('two-royal-passing', '2', '王道の2始まり・2536', '2536 · 3mから3⁷へ', '3mの4拍目を3⁷に変え、6mへ向かう。', [c.ii, c.V, c.iii, c.vi], [{ bar: 2, beat: 3, chord: c.III7 }]),
  preset('two-dominant', '2', '王道の2始まり・2536', '2536 · テンションと3⁷', '2m9→5¹³から3⁷→6m9へ進む変化形。 後半は4△9から展開し6⁷で2mへ戻る。', [c.ii9, c.V13, c.III7, c.vi9, c.IV9, c.V13, c.IIIb9, c.VI7]),
  preset('two-marusa', '2', '丸サの2始まり・236', '2361 · 2から丸サへ', '4を2mへ置き換えた丸サ系。 後半は4から始め6⁷で2mへ戻る。', [c.ii, c.III7, c.vi, c.I7, c.IVM7, c.III7, c.vi, c.VI7]),
  preset('jazz', '2', '解決・251', '251 · 1で落ち着く', '2m→5⁷→1△7。元のジャズプリセット。', [c.ii, c.V7, c.IM7, c.IM7]),
  preset('two-cycle', '2', '循環・2516', '2516 · 6⁷で次の2へ', '終端の6⁷が次の2mへ戻す循環。 後半は4→3m→6mから6⁷で2mへ。', [c.ii, c.V7, c.IM7, c.VI7, c.IVM7, c.iii, c.vi, c.VI7]),
  preset('two-cycle-turn', '2', '循環・2516', '2516 · 1から6⁷へ', '3小節目の3拍目に6⁷を加え、2mへ戻る準備をする。', [c.ii, c.V7, c.IM7, c.ii], [{ bar: 2, beat: 2, chord: c.VI7 }, { bar: 3, beat: 2, chord: c.V7 }]),
  preset('two-circle-eight', '2', '循環・2516', '8小節 · 五度でつなぐ', '2→5→1→4→7→3→6→6⁷の長い循環。', [c.ii, c.V7, c.IM7, c.IVM7, c.vii, c.III7, c.vi, c.VI7]),
  preset('two-float', '2', '浮遊・隣り合う和音', '2→3→4→3', '解決を急がず、隣の和音へ往復する試作用。', [c.ii9, c.iii, c.IVM7, c.iii]),
  preset('two-borrowed', '2', '借用・マイナー4', '2→4m→1→6⁷', '2mから4mへ色を変え、循環へ戻す変化形。 後半も4mの響きを残し6⁷から2mへ。', [c.ii, c.iv6, c.IM7, c.VI7, c.IVM7, c.iv6, c.IM7, c.VI7]),

  preset('pop', '1', '4コード・1564', 'ポップ / 1–5–6–4', '明るさと切なさが交互に現れる4コードの基本形。', [c.I, c.V, c.vi, c.IV]),
  preset('pop-passing', '1', '4コード・1564', '1564 · 4拍目に3⁷', '5の最後に3⁷を挟み、次の6mへ向かう。 後半は4から王道進行へ展開する。', [c.I, c.V, c.vi, c.IV, c.IVM7, c.V, c.iii, c.vi], [{ bar: 1, beat: 3, chord: c.III7 }]),
  preset('classic', '1', '循環・16', '定番 / 1–6–4–5', '1から6へ陰り、4→5で戻る。', [c.I, c.vi, c.IV, c.V]),
  preset('one-cycle', '1', '循環・16', '1625 · 2から戻す', '1→6→2→5。メロディを置きやすい循環。 後半は4→3m→2m→5⁷へ下る。', [c.IM7, c.vi, c.ii, c.V7, c.IVM7, c.iii, c.ii, c.V7]),
  preset('one-city', '1', '循環・16', '1625 · 9thと6⁷', '6⁷で2mを導き、9thで柔らかさを加えた変化形。 後半は4△9から2m9へ展開する。', [c.I9, c.VI7, c.ii9, c.V13, c.IV9, c.III7, c.ii9, c.V13]),
  preset('one-cycle-turn', '1', '循環・16', '1625 · 6m→6⁷', '2小節目の3拍目に6⁷へ変え、2m9へ導く。', [c.I9, c.vi, c.ii9, c.V13], [{ bar: 1, beat: 2, chord: c.VI7 }]),
  preset('one-canon', '1', 'カノン・8小節', 'カノン · 1→5→6→3…', '1→5→6→3→4→1→2→5。8小節で展開。', [c.I, c.V, c.vi, c.iii, c.IV, c.I, c.ii, c.V7]),
  preset('one-marusa-lead', '1', '丸サへの展開', '8小節 · 1から丸サへ', '前半は1始まり、後半は4始まりの丸サ系へ。', [c.IM7, c.III7, c.vi, c.v, c.IVM7, c.III7, c.vi, c.I7], [{ bar: 3, beat: 2, chord: c.I7 }]),
  preset('one-minor', '1', '借用・浮遊', '1⇄4m · 明暗を往復', '1△7と借用した4m6だけで色を変える。', [c.IM7, c.iv6]),
  preset('one-floating', '1', '借用・浮遊', '1⇄4 · 9thの浮遊感', '2つのmaj9を繰り返す、メロディとグルーブの試作用。', [c.I9, c.IV9]),
  preset('game-indie-memory', '1', 'ゲーム・回想', 'ゲーム · 回想の1→4m', '1と4の明るさに4mを挟み、柔らかな余韻を作る。 後半は4→4mの余韻を経て1へ戻る。', [c.IM7, c.IVM7, c.I, c.V, c.IVM7, c.iv6, c.IM7, c.V7], [{ bar: 1, beat: 2, chord: c.iv6 }, { bar: 3, beat: 2, chord: c.V7 }]),

  preset('komuro', '6', '小室・6451', '6451 · 小室進行', '6mから4→5→1へ開く基本形。', [c.vi, c.IVM7, c.V, c.I]),
  preset('komuro-turn', '6', '小室・6451', '小室 · 1から3⁷へ', '4小節目の4拍目に3⁷を置き、後半は7ø→3⁷から6mへ帰る。', [c.vi, c.IVM7, c.V, c.I, c.vi, c.IVM7, c.vii, c.III7], [{ bar: 3, beat: 3, chord: c.III7 }]),
  preset('sensitive', '6', '4コード・6415', 'せつない / 6–4–1–5', '短調から始める4コードの基本形。', [c.vi, c.IV, c.I, c.V]),
  preset('sensitive-passing', '6', '4コード・6415', '6415 · 4から4mへ', '2小節目の3拍目に4mを借り、1へ柔らかく着地する。 後半は2m→3⁷を経て6mへ。', [c.vi, c.IVM7, c.IM7, c.V, c.vi, c.IVM7, c.ii, c.III7], [{ bar: 1, beat: 2, chord: c.iv6 }]),
  preset('six-dark', '6', '短調ループ', '6→5→4→3⁷ · 下降', '平行短調ではi→♭VII→♭VI→V。3⁷で6mへ戻る。', [c.vi, c.V, c.IVM7, c.III7]),
  preset('game-indie-battle', '6', 'ゲーム・短調の緊張', 'ゲーム · 6m→5→4→3⁷', '短調の下降に3⁷を加え、6mへ戻る緊張感を作る。 後半は7ø→3⁷で短調へ帰る。', [c.vi, c.V, c.IVM7, c.III7, c.vi, c.IVM7, c.vii, c.III7], [{ bar: 2, beat: 3, chord: c.vii }]),
  preset('game-indie-shadow', '6', 'ゲーム・短調の緊張', 'ゲーム · 6m→4→7ø→3⁷', '短調の中心から7ø→3⁷へ動き、6mへ帰る。 後半は4→5から短調へ帰る。', [c.vi, c.IVM7, c.vii, c.III7, c.IVM7, c.V, c.vii, c.III7], [{ bar: 1, beat: 3, chord: c.ii }]),
  preset('six-step', '6', '短調ループ', '6→4→5→6 · 短調へ戻る', '4→5の上昇を6mで受け止める。', [c.vi, c.IVM7, c.V, c.vi]),
  preset('six-royal', '6', '短調ループ', '6→4→5→3 · 王道の回転', '4536を6から始めた形。歌い出しの違いを比べる。 後半は2m→5⁷から3⁷を経て6mへ。', [c.vi, c.IVM7, c.V, c.iii, c.ii, c.V7, c.iii, c.III7]),
  preset('six-two', '6', '循環・6251', '6251 · 長調へ向かう', '6m→2m→5→1で明るい終点へ。 後半は4から短調の7ø→3⁷へ向かう。', [c.vi, c.ii, c.V, c.IM7, c.IVM7, c.ii, c.vii, c.III7]),
  preset('six-minor-cycle', '6', '循環・6251', '6→2→7ø→3⁷', '後半を短調のiiø→Vにして、6mへ戻す。 後半は4→5から短調へ帰る。', [c.vi, c.ii, c.vii, c.III7, c.IVM7, c.V, c.vii, c.III7]),
  preset('six-funk', '6', '少ない和音・グルーブ', '6m9⇄2⁹ · ドリアン', '平行短調のi9⇄IV9。上がった6度が色を変える。', [c.vi9, c.II9]),
  preset('six-pedal', '6', '少ない和音・グルーブ', '6m7 · ワンコード', '和音を固定してドラム・ベース・メロディを試す。', [c.vi]),
  preset('six-suspended', '6', '少ない和音・グルーブ', '6→4→5sus→5', '最後のsusを解いて、次の6mへつなぐ変化形。', [c.vi9, c.IV9, c.Vsus, c.V]),

  preset('three-cycle', '3', '循環・3625', '3625 · 3から循環', '3m→6⁷→2m→5⁷でつなぐ。 後半は1→4→2m→5⁷へ展開する。', [c.iii, c.VI7, c.ii, c.V7, c.IM7, c.IVM7, c.ii, c.V7]),
  preset('three-cycle-passing', '3', '循環・3625', '3625 · 3m→3⁷', '3mの4拍目を3⁷に変え、6mから循環へ。', [c.iii, c.vi, c.ii, c.V7], [{ bar: 0, beat: 3, chord: c.III7 }, { bar: 1, beat: 3, chord: c.VI7 }]),
  preset('three-major', '3', '3⁷から6へ', '3⁷→6→2→5', '最初から3⁷で6mへの引力を出す。 後半は4を入口に再び循環する。', [c.III7, c.vi, c.ii, c.V7, c.IVM7, c.III7, c.ii, c.V7]),
  preset('three-altered', '3', '3⁷から6へ', '3⁷(♭9,♭13)から', '緊張した3⁷を6m9へ解決する変化形。', [c.IIIalt, c.vi9, c.ii9, c.V13]),
  preset('three-soft', '3', '余韻・3645', '3645 · 柔らかく始める', '3m→6mから4→5へ上がる。 後半は4→5から6⁷へ進む。', [c.iii, c.vi, c.IVM7, c.V, c.IVM7, c.V, c.iii, c.VI7]),

  preset('sharp-four-down', '#4', '半音下降・発展', '♯4ø→4→3→6⁷', 'ベースを半音で下げてから循環する試作用。 後半は2→5→1→4を経て♯4へ。', [c.sharpIV, c.IVM7, c.iii, c.VI7, c.ii, c.V7, c.IM7, c.IVM7]),
  preset('blackadder', '#4', '分数aug・発展', 'III+/♯4から半音下降', 'ブラックアダーを入口に、4→3→6へ進む発展形。', [c.blackadder, c.IVM7, c.iii, c.vi]),
  preset('sharp-four-cycle', '#4', '循環・発展', '♯4ø→7⁷→3→6⁷', '♯4ø→7⁷で3mを導く、長い循環の一部。 後半は2→5→1→4と巡る。', [c.sharpIV, c.VII7, c.iii, c.VI7, c.ii, c.V7, c.IM7, c.IVM7]),

  preset('seven-down', '7', 'オンコード・下降', 'V/7→6→4→5', '最初はG/B型。分類の7は和音の根音ではなくベース。', [c.VonVII, c.vi, c.IVM7, c.V]),
  preset('seven-down-passing', '7', 'オンコード・下降', 'V/7→6 · 3⁷を挟む', '1小節目の4拍目に3⁷を挟み、次の6mへ向かう。', [c.VonVII, c.vi, c.IVM7, c.V], [{ bar: 0, beat: 3, chord: c.III7 }]),
  preset('seven-minor', '7', '短調の入口・7ø', '7ø→3⁷→6→6', '平行短調のiiø→V→iで落ち着く。 後半は4→5から2mを経て7øへ。', [c.vii, c.III7, c.vi, c.vi, c.IVM7, c.V, c.vi, c.ii]),
  preset('seven-cycle', '7', '短調の入口・7ø', '7ø→3⁷→6→2⁷', '短調へ解決した後、2⁷で次の動きを促す発展形。 後半は4→5から2mを経て7øへ。', [c.vii, c.III7, c.vi, c.II7, c.IVM7, c.V, c.vi, c.ii]),
  preset('flat-seven-down', 'b7', '借用・発展', '♭7⁷→6→2→5', '長調外の♭7⁷から6mへ下がる試作用。 後半は4mを借用し、5⁷から♭7へ戻る。', [c.bVII7, c.vi, c.ii, c.V7, c.IVM7, c.iv6, c.IM7, c.V7]),
  preset('flat-seven-open', 'b7', '借用・発展', '♭7→1→4→4', '借用和音から長調へ開く。', [c.bVII, c.I, c.IVM7, c.IVM7]),
  preset('flat-six-dim', 'b6', '半音アプローチ・発展', '♭6dim7→6→2→5', '♭6dim7から半音上の6mへ寄せる。', [c.bVIdim, c.vi, c.ii, c.V7]),
  preset('flat-six-open', 'b6', '借用・発展', '♭6→♭7→1→1', '平行短調の和音から長調の1へ上がる。 後半は4mを経て♭6へ戻る。', [c.bVI, c.bVII7, c.IM7, c.IM7, c.IVM7, c.iv6, c.IM7, c.V7]),
  preset('flat-two-home', 'b2', '裏コード・発展', '♭2⁷→1→6⁷→2', '5⁷の代わりに半音上の♭2⁷から1へ。 後半は4mの陰りを経て♭2へ戻る。', [c.bII7, c.IM7, c.VI7, c.ii, c.IVM7, c.iv6, c.IM7, c.V7]),
  preset('flat-two-colour', 'b2', '裏コード・発展', '♭2⁹→1△9→4→5', '裏コードの9thを長調のmaj9へほどく変化形。', [c.bII9, c.I9, c.IVM7, c.V7]),
  preset('flat-three-dim', 'b3', '半音アプローチ・発展', '♭3dim7→3→6→2', '♭3dim7から3mへ半音で寄せる。', [c.bIIIdim, c.iii, c.vi, c.ii]),
  preset('flat-three-open', 'b3', '借用・発展', '♭3→4→1→1', '長調外の♭3から4を経て1へ。 後半は4mを経て♭3へ戻る。', [c.bIII, c.IVM7, c.IM7, c.IM7, c.IVM7, c.iv6, c.IM7, c.V7]),
  // Full eight-bar phrases: the second half develops the first and leads back to bar 1.
  preset('eight-royal-return', '4', '8小節・展開', '8小節 · 王道から帰る', '前半は王道、後半は2mから動き、最後の1⁷で4へ戻る。', [c.IVM7, c.V, c.iii, c.vi, c.ii, c.V7, c.iii, c.vi], [{ bar: 2, beat: 3, chord: c.III7 }, { bar: 7, beat: 2, chord: c.v }, { bar: 7, beat: 3, chord: c.I7 }]),
  preset('eight-456-marusa', '4', '8小節・展開', '8小節 · 456から丸サへ', '456で上昇し、後半は丸サへ。最後の1⁷が次の4を呼ぶ。', [c.IVM7, c.V, c.vi, c.I, c.IVM7, c.III7, c.vi, c.v], [{ bar: 1, beat: 3, chord: c.III7 }, { bar: 7, beat: 2, chord: c.I7 }]),
  preset('eight-four-minor', '4', '8小節・展開', '8小節 · 4mの余韻', '前半を明るく進め、後半の4mで陰りを加えて4へ戻る。', [c.IVM7, c.V, c.iii, c.vi, c.IVM7, c.iv6, c.IM7, c.v], [{ bar: 7, beat: 2, chord: c.I7 }]),
  preset('eight-two-lift', '2', '8小節・展開', '8小節 · 2から上昇', '2mから王道へ進み、後半は4から上昇して6⁷で2mへ。', [c.ii, c.V, c.iii, c.vi, c.IVM7, c.V, c.vi, c.VI7], [{ bar: 2, beat: 3, chord: c.III7 }]),
  preset('eight-two-marusa', '2', '8小節・展開', '8小節 · 2から丸サへ', '2m→5の後に丸サ系へ広げ、最後の6⁷で始点へつなぐ。', [c.ii, c.V7, c.IM7, c.I7, c.IVM7, c.III7, c.vi, c.VI7]),
  preset('eight-pop-bridge', '1', '8小節・展開', '8小節 · ポップの後半展開', '1564から2mへ展開し、最後の5⁷で1へ帰る。', [c.I, c.V, c.vi, c.IVM7, c.ii, c.iii, c.IVM7, c.V7], [{ bar: 1, beat: 3, chord: c.III7 }, { bar: 6, beat: 3, chord: c.iv6 }]),
  preset('eight-one-borrowed', '1', '8小節・展開', '8小節 · 4mから1へ', '1から広がり、後半の4mと2m→5⁷を経て戻る。', [c.IM7, c.vi, c.ii, c.V7, c.IVM7, c.iv6, c.IM7, c.ii], [{ bar: 7, beat: 2, chord: c.V7 }]),
  preset('eight-komuro-rise', '6', '8小節・展開', '8小節 · 小室から上昇', '小室進行の後に4→5で持ち上げ、3⁷で6mへ戻る。', [c.vi, c.IVM7, c.V, c.I, c.IVM7, c.V, c.iii, c.III7], [{ bar: 6, beat: 2, chord: c.vi }, { bar: 7, beat: 2, chord: c.IIIb9 }]),
  preset('eight-minor-game', '6', '8小節・展開', '8小節 · 短調の冒険', '短調の下降から4→5へ上がり、7ø→3⁷で6mへ帰る。', [c.vi, c.V, c.IVM7, c.III7, c.vi, c.IVM7, c.V, c.vii], [{ bar: 7, beat: 2, chord: c.III7 }]),
  preset('eight-minor-memory', '6', '8小節・展開', '8小節 · 短調から光へ', '6mから1へ開き、4mの陰りを経て3⁷から始点へ。', [c.vi, c.IVM7, c.I, c.V, c.ii, c.iv6, c.vi, c.III7]),
  preset('eight-three-cycle', '3', '8小節・展開', '8小節 · 3から巡る', '3mから循環し、後半は4mの陰りを経て5から3mへ。', [c.iii, c.VI7, c.ii, c.V7, c.IM7, c.IVM7, c.iv6, c.V7]),
  preset('eight-sharp-four', '#4', '8小節・展開', '8小節 · 半音下降から循環', '♯4から半音ずつ下り、後半の4から♯4へ戻る。', [c.sharpIV, c.IVM7, c.iii, c.vi, c.ii, c.V7, c.IM7, c.IVM7], [{ bar: 2, beat: 3, chord: c.III7 }]),
  preset('eight-seven-minor', '7', '8小節・展開', '8小節 · 短調の入口から', '7ø→3⁷で短調へ入り、後半の2mから7øへ帰る。', [c.vii, c.III7, c.vi, c.V, c.IVM7, c.V, c.vi, c.ii], [{ bar: 5, beat: 3, chord: c.III7 }]),
  preset('eight-five-pop', '5', '8小節・展開', '8小節 · 5から広がる', '5から王道を巡り、最後に4→4mを置いて次の5へ。', [c.V, c.iii, c.vi, c.IVM7, c.I, c.vi, c.ii, c.IVM7], [{ bar: 1, beat: 3, chord: c.III7 }, { bar: 7, beat: 2, chord: c.iv6 }]),

  // Genre arrangements are original loops. Short vamps leave room for the rhythm section.
  preset('novel-keys', '4', 'J-POP', '鍵盤で追いかける夜', '3⁷から6mへ進み、半音のディミニッシュを挟んで冒頭へ戻る。', [c.IVM7, c.III7, c.vi, c.v, c.IVM7, c.bIIIdim, c.ii, c.V7], [{ bar: 1, beat: 3, chord: c.IIIb9 }, { bar: 3, beat: 2, chord: c.blackadder }, { bar: 4, beat: 3, chord: c.iii }, { bar: 7, beat: 2, chord: c.blackadder }]),
  preset('pop-scene', '6', 'J-POP', '二つの照明', '6mの反復から♭3・♭7へ景色を切り替え、3⁷の緊張を残して戻る。', [c.vi, c.vi, c.IV, c.III7, c.bIII, c.bVII, c.ii, c.IIIalt], [{ bar: 3, beat: 3, chord: c.vi }]),
  preset('break-rock', '3', 'J-POP', 'リフから場面転換', '3mに重心を置き、♭7から6⁷へ。後半は4m6と3⁷の緊張を経て戻る。', [c.iii, c.iii, c.bVII, c.VI7, c.ii, c.IV, c.vii, 'x:2:maj:s9_b13:0'], [{ bar: 5, beat: 2, chord: c.iv6 }]),
  preset('pop-shadow', '1', 'J-POP', '長調の中の影', '1から入る穏やかな歌の間に、借用の♭6と4mを一小節ずつ差し込む。', [c.IM7, c.iii, c.IV, c.iv6, c.vi, c.bVI, c.ii, c.Vsus], [{ bar: 7, beat: 2, chord: c.V7 }]),
  preset('midnight-disco', '2', 'J-POP', '真夜中のストップと返事', '2m9と5¹³の掛け合いから、♭3と裏コードで色を変える。', [c.ii9, c.ii9, c.V13, c.V13, c.I9, c.bIII, c.ii9, c.bII7], [{ bar: 7, beat: 2, chord: c.bVII7 }]),
  preset('wordbeat', '7', 'J-POP', '七度から跳ぶ', '7øから3⁷、6mへ。後半は♭6dim7と5m9で流れを変える。', [c.vii, c.III7, c.vi, c.VI7, c.vii, c.III7, 'x:5:min:11:0', 'x:4:min:9:0'], [{ bar: 5, beat: 2, chord: c.bVIdim }, { bar: 7, beat: 2, chord: c.I7 }]),
  preset('arc-shibuya', '1', '音楽ゲーム', '坂道のカフェ', '1△7から6⁷と♭3dim7を経て、5⁷(♭13)へ。後半は4m6で切なく戻る。', [c.IM7, c.VI7, c.ii9, 'x:4:maj:b13:0', c.iii, c.VI7, c.IV9, c.iv6], [{ bar: 1, beat: 3, chord: c.bIIIdim }, { bar: 7, beat: 3, chord: c.V7 }]),
  preset('arc-swing', '2', '音楽ゲーム', '幕が開くターンアラウンド', '2mから5⁷、1△7へ。♯4m7♭5を経て5⁷(♭13)で次の周へ。', [c.ii, c.V7, c.IM7, c.vi, c.IVM7, c.sharpIV, c.V, 'x:4:maj:b13:0']),
  preset('arc-toy', '1', '音楽ゲーム', 'おもちゃ箱の階段', '1から♭3へ跳ね、♭3dim7を経て2mへ。最後は5⁷sus4から5⁷(♭13)へ。', [c.I, c.bIII, c.bIIIdim, c.ii, c.I, c.sharpIV, c.bIIIdim, c.Vsus], [{ bar: 3, beat: 2, chord: c.V7 }, { bar: 7, beat: 2, chord: 'x:4:maj:b13:0' }]),
  preset('arc-cabaret', '6', '音楽ゲーム', '路地裏の舞台', '短調の6mに3⁷が答え、後半は2mと減和音をたどって3⁷へ。', [c.vi, c.III7, c.vi, c.VI7, c.ii, c.sharpIV, c.vii, c.IIIb9]),
  preset('arc-trance', '6', '音楽ゲーム', '夜明けのサスペンド', '6m9から2m7、III+/♯IVを経て4△7へ。3のオルタードと♭6dim7で次の周へ戻る。', [c.vi9, c.vi9, c.ii, c.blackadder, c.IVM7, 'x:1:min:add11:0', 'x:2:maj:s9_b13:0', 'x:2:maj:s9_b13:0'], [{ bar: 7, beat: 2, chord: c.bVIdim }]),
  preset('arc-tech', '3', '音楽ゲーム', '二音圏のチェイス', '3mから4へ進み、半音下降するディミニッシュを経て♭2△7へ。', [c.iii, c.iii, c.IV, 'x:3:min:maj7:0', c.iii, c.bIIIdim, c.ii, 'x:1:maj:maj7:11']),
  preset('arc-piano', '#4', '音楽ゲーム', '半音で滑る階段', '♯4øから半音ずつ降り、3⁷の緊張を経て6m9へ。', [c.sharpIV, c.IVM7, c.iii, c.bIIIdim, c.ii9, 'x:2:maj:s9_b13:0', c.vi9, c.v], [{ bar: 7, beat: 2, chord: c.blackadder }]),
  preset('arc-pixel', 'b7', '音楽ゲーム', 'ピクセルの大跳躍', '♭7→4→1で明るく開き、後半は♭3から鍵盤を飛び越えて戻る。', [c.bVII, c.IV, c.I, c.I, c.bIII, c.bVII, c.IV, c.I], [{ bar: 2, beat: 3, chord: c.Vsus }, { bar: 7, beat: 2, chord: c.v }, { bar: 7, beat: 3, chord: c.I7 }]),
  preset('club-hook', '2', 'ダンス・フック', '短調のフックと明るい4度', '2mの反復に5の長三度が差す、ドリアンのフック。', [c.ii, c.ii, c.V, c.ii, c.ii, c.ii, c.V, c.Vsus], [{ bar: 7, beat: 3, chord: c.V }]),
  preset('velvet-rnb', '1', 'R&B・循環', '9thのゆるい折り返し', '1△9を長く聴かせ、後半は3⁷と6m9から2m9へ回り込む。', [c.I9, c.I9, c.ii9, c.V13, c.I9, c.III7, c.vi9, c.ii9], [{ bar: 7, beat: 2, chord: c.V13 }]),
  preset('bright-disco', '1', 'ディスコ・フック', '短い問いと裏拍の答え', '1から2mへ跳ね、最後の二拍で5susをほどく。', [c.I, c.ii, c.iii, c.IV, c.I, c.ii, c.IV, c.Vsus], [{ bar: 3, beat: 3, chord: c.V }, { bar: 7, beat: 2, chord: c.V7 }]),
  preset('night-bounce', '6', 'R&B・浮遊', '夜のふたつの9th', '6m9と4△9の二和音をゆっくり反復。最後にだけ3mが返事する。', [c.vi9, c.vi9, c.IV9, c.IV9, c.vi9, c.vi9, c.IV9, c.iii]),
  preset('spell-flight', '2', '弾幕・展開', '短調の波を二段上る', '2mから♭7、♭3へ。後半は半音の色彩を重ねて戻る。', [c.ii, c.bVII, c.bIII, c.iii, 'x:3:min:none:0', 'x:1:maj:none:11', 'x:3:maj:maj9:1', c.v], [{ bar: 3, beat: 2, chord: 'x:5:sus4:none:0' }, { bar: 7, beat: 2, chord: 'x:5:maj:none:0' }]),
  preset('moon-flight', '6', '弾幕・展開', '短調の旋回と導音', '6mから2mへ進み、7øと3⁷で旋回。二周目は平行長調に開く。', [c.vi, c.ii, c.vii, c.III7, c.IVM7, c.V, c.IM7, c.III7], [{ bar: 5, beat: 3, chord: c.VonVII }, { bar: 7, beat: 2, chord: c.IIIb9 }]),
  preset('save-room', '1', 'ゲーム・回想', '灯りのともる部屋', '1add9を二小節聴かせる。後半の4→4mで同じ景色を少しだけ曇らせる。', ['x:0:maj:add9:0', 'x:0:maj:add9:0', c.iii, c.IVM7, 'x:0:maj:add9:0', c.vi, c.IVM7, c.iv6]),
  preset('clockwork-battle', '6', 'ゲーム・リフ', 'からくりの追いかけっこ', '6mのリフと♭7△7を反復し、3⁷で出発点に戻る。', ['x:5:min:none:0', 'x:5:min:none:0', 'x:6:maj:maj7:11', 'x:6:maj:maj7:11', 'x:5:min:none:0', c.ii, c.bVII, c.III7]),
  preset('garage-shuffle', '2', 'ガラージ・循環', '跳ねる2m9の輪', '2m9と5¹³の応答。後半の1△9から6⁷でループへ戻る。', [c.ii9, c.V13, c.ii9, c.V13, c.ii9, c.V13, c.I9, c.VI7]),
  preset('liquid-break', '6', 'ブレイク・浮遊', '高速ビートに長い和音', '忙しいドラムの上で6m9と1△9を長く保ち、後半は4△9→2m9へ。', [c.vi9, c.vi9, c.I9, c.I9, c.IV9, c.IV9, c.ii9, 'x:2:maj:s9_b13:0']),
  preset('dub-yard', '2', 'ダブ・反復', 'ワンドロップの二和音', '2mと5を二小節ずつ。和音の間を低音に渡す。', [c.ii, c.ii, c.V, c.V]),
  preset('five-suspended', '5', 'sus・解決', '5sus→5→1→6', 'susを解いて1へ、最後は6mで次へつなぐ。', [c.Vsus, c.V7, c.IM7, c.vi]),
  preset('five-royal', '5', '王道の回転', '5364 · 5から王道へ', '4536を5から始めた形。着地点の違いを比べる。 後半は2mから巡って5へ戻る。', [c.V, c.iii, c.vi, c.IVM7, c.ii, c.V7, c.iii, c.IVM7]),
])

/** @param {string} id */
function findPreset(id) {
  const selected = presets.find((item) => item.id === id)
  if (!selected) throw new RangeError('Unknown preset')
  return selected
}

/** Repeat the authored phrase to fill eight bars, always returning new state.
 * @param {string} id */
export function presetSlots(id) {
  const selected = findPreset(id)
  return Array.from({ length: 8 }, (_, bar) => selected.pattern[bar % selected.pattern.length])
}

/** @param {string} id @returns {(string | null)[][]} */
export function presetBeatSlots(id) {
  const selected = findPreset(id)
  return Array.from({ length: 8 }, (_, bar) => {
    /** @type {(string | null)[]} */
    const beats = [null, null, null, null]
    for (const change of selected.changes) {
      if (change.bar === bar % selected.pattern.length) beats[change.beat] = change.chord
    }
    return beats
  })
}
