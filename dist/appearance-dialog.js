import { createApp, h, ref } from './vendor/vue.runtime.esm-browser.prod.js'

const choices = [
  { id: 'milk', name: 'ミルク', description: '乳白色のキーと朱色の再生ボタン' },
  { id: 'natural', name: 'ナチュラル', description: '明るい白木色の筐体、白いキー、蜂蜜色のアクセント' },
  { id: 'bauhaus', name: 'バウハウス', description: '深い赤・青・黄。積み木のような落ち着いた原色' },
  { id: 'toy', name: 'トイ', description: '赤・青・黄色の、にぎやかな音のおもちゃ' },
]

/** @param {{ current: () => string, select: (skin: string) => void, close: () => void }} actions */
export function mountAppearanceDialog(actions) {
  const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('#appearance-dialog'))
  const selected = ref(actions.current())
  createApp({
    setup() {
      return () => [
        h('div', { class: 'dialog-heading' }, [
          h('div', [
            h('h2', { id: 'appearance-title' }, '今日の、音の道具。'),
            h('p', { id: 'appearance-description' }, ['好きな色と手ざわりで、遊ぼう。', h('br'), 'スキンはすぐに反映され、次回も引き継がれます。']),
          ]),
          h('button', { id: 'appearance-close', class: 'dialog-close', type: 'button', 'aria-label': '外観設定を閉じる', onClick: actions.close }, '×'),
        ]),
        h('fieldset', { class: 'skin-options' }, [
          h('legend', { class: 'sr-only' }, 'スキンを選択'),
          ...choices.map(choice => h('label', { class: 'skin-choice', key: choice.id }, [
            h('input', { type: 'radio', name: 'skin', value: choice.id, checked: selected.value === choice.id,
              onChange: () => { selected.value = choice.id; actions.select(choice.id) } }),
            h('span', { class: `skin-preview ${choice.id}`, 'aria-hidden': 'true' }, Array.from({ length: 8 }, () => h('i'))),
            h('strong', choice.name),
            h('small', choice.description),
          ])),
        ]),
      ]
    },
  }).mount(dialog)
  return { open() { selected.value = actions.current(); dialog.showModal() } }
}
