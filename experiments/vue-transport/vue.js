import { createApp, ref, computed } from '/node_modules/vue/dist/vue.esm-browser.prod.js'

createApp({
  setup() {
    const playing = ref(false)
    const countIn = ref(true)
    const status = computed(() => playing.value
      ? (countIn.value ? 'カウントインありで再生中' : '再生中')
      : '待機中')
    return { playing, countIn, status }
  },
  template: `<label><input type="checkbox" v-model="countIn"> カウントイン</label>
    <button type="button" :aria-pressed="playing" @click="playing = !playing">{{ playing ? '■ 停止' : '▶ 再生' }}</button>
    <p>{{ status }}</p>`,
}).mount('#vue')
