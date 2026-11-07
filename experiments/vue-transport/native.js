const root = document.querySelector('#native')
root.innerHTML = `<label><input type="checkbox" checked> カウントイン</label>
  <button type="button" aria-pressed="false">▶ 再生</button><p>待機中</p>`
const button = root.querySelector('button')
const countIn = root.querySelector('input')
const status = root.querySelector('p')
let playing = false
button.addEventListener('click', () => {
  playing = !playing
  button.textContent = playing ? '■ 停止' : '▶ 再生'
  button.setAttribute('aria-pressed', String(playing))
  status.textContent = playing ? (countIn.checked ? 'カウントインありで再生中' : '再生中') : '待機中'
})
countIn.addEventListener('change', () => {
  if (playing) status.textContent = countIn.checked ? 'カウントインありで再生中' : '再生中'
})
