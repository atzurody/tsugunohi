import { DialogueLine } from "./types";

// TOTAL_LOOPS = 4 (loop 0,1,2,3 → ending)

export function getStoryDialogue(loop: number): DialogueLine[] {
  switch (loop) {
    case 0: // 1日目 — 日常の帰り道、ユカリの不在
      return [
        { text: "......また、この道。", speaker: "mono", opacity: 0, duration: 360 },
        { text: "はぁ...帰ろう。", speaker: "mono", opacity: 0, duration: 270 },
        { text: "いつもの帰り道。", speaker: "mono", opacity: 0, duration: 300, triggerX: 1700 },
        { text: "今日も一人で帰る。", speaker: "mono", opacity: 0, duration: 300, triggerX: 1400 },
        { text: "隣にはもう、誰もいない。", speaker: "mono", opacity: 0, duration: 300, triggerX: 1100 },
        { text: "あの子がいなくなってから、ずっと。", speaker: "mono", opacity: 0, duration: 330, triggerX: 750 },
        { text: "「ミサキ、明日も一緒に帰ろうね」", speaker: "voice", opacity: 0, duration: 360, triggerX: 450 },
        { text: "...ユカリ。", speaker: "mono", opacity: 0, duration: 300, triggerX: 200 },
      ];

    case 1: // 2日目 — いじめの記憶、見て見ぬふり
      return [
        { text: "あの日のこと、思い出したくない。", speaker: "mono", opacity: 0, duration: 300, triggerX: 1900 },
        { text: "でも、歩くたびに蘇る。", speaker: "mono", opacity: 0, duration: 270, triggerX: 1700 },
        { text: "「ねえ、あの子まだこっち見てるよ」", speaker: "voice", opacity: 0, duration: 330, triggerX: 1450 },
        { text: "「無視しなよ、ウザいから」", speaker: "voice", opacity: 0, duration: 300, triggerX: 1200 },
        { text: "みんなが笑った。\n私も...つられて笑った。", speaker: "mono", opacity: 0, duration: 360, triggerX: 950 },
        { text: "「ミサキ...助けて」", speaker: "voice", opacity: 0, duration: 360, triggerX: 700 },
        { text: "...聞こえないふりをした。", speaker: "mono", opacity: 0, duration: 300, triggerX: 450 },
        { text: "あの子たちに嫌われるのが\n怖かったから。", speaker: "mono", opacity: 0, duration: 360, triggerX: 200 },
      ];

    case 2: // 3日目 — ユカリの死と未読メッセージ
      return [
        { text: "翌朝、学校に着いたら\nみんな泣いていた。", speaker: "memory", opacity: 0, duration: 390, triggerX: 1900 },
        { text: "先生の声が震えていた。", speaker: "memory", opacity: 0, duration: 300, triggerX: 1650 },
        { text: "ユカリが、屋上から。", speaker: "mono", opacity: 0, duration: 330, triggerX: 1400 },
        { text: "「昨日の放課後、\n　一人で泣いてたらしいよ」", speaker: "voice", opacity: 0, duration: 390, triggerX: 1100 },
        { text: "あの時間、私はあの子たちと\n笑っていた。", speaker: "mono", opacity: 0, duration: 390, triggerX: 800 },
        { text: "ユカリが最後に送ってきた\nメッセージ、まだ未読のまま。", speaker: "mono", opacity: 0, duration: 390, triggerX: 500 },
        { text: "「どうして私を見捨てたの？」", speaker: "voice", opacity: 0, duration: 420, triggerX: 250 },
      ];

    case 3: // 4日目（最終）— ユカリの声、永遠のループ
      return [
        { text: "許して。ごめんなさい、ユカリ。", speaker: "mono", opacity: 0, duration: 330, triggerX: 1900 },
        { text: "「もう遅いよ」", speaker: "voice", opacity: 0, duration: 330, triggerX: 1650 },
        { text: "「あの日、一言でよかったのに」", speaker: "voice", opacity: 0, duration: 360, triggerX: 1400 },
        { text: "「やめなよ、って。\n　たったそれだけで」", speaker: "voice", opacity: 0, duration: 390, triggerX: 1100 },
        { text: "「あなたが何もしなかったから\n　私は死んだの」", speaker: "voice", opacity: 0, duration: 420, triggerX: 800 },
        { text: "嫌だ。嫌だ。嫌だ。", speaker: "mono", opacity: 0, duration: 270, triggerX: 550 },
        { text: "「逃げないで、ミサキ」", speaker: "voice", opacity: 0, duration: 300, triggerX: 350 },
        { text: "「ずっと」", speaker: "voice", opacity: 0, duration: 300, triggerX: 150 },
      ];

    default:
      return [];
  }
}

export function getEndingTexts(): { text: string; start: number; end: number; style: "normal" | "red" | "white" }[] {
  return [
    { text: "ユカリの遺書には、こう書いてあった。", start: 60, end: 300, style: "normal" },
    { text: "「ミサキだけは私の味方だと\n　信じていました」", start: 340, end: 580, style: "white" },
    { text: "「でも、あの日\n　ミサキも私を見捨てました」", start: 620, end: 860, style: "white" },
    { text: "「もう誰も信じられません」", start: 900, end: 1100, style: "white" },
    { text: "ミサキは今日も\n同じ帰り道を歩いている。", start: 1180, end: 1420, style: "normal" },
    { text: "一人で。永遠に。", start: 1500, end: 1740, style: "red" },
    { text: "つ ぐ の ひ", start: 1900, end: 2400, style: "red" },
    { text: "― 次ぐ日 ―", start: 2000, end: 2400, style: "normal" },
  ];
}
