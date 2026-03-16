import {createApp} from 'vue'
import {createPinia} from 'pinia'
import router from './router'
import App from './App.vue'
import './styles.css'
import 'highlight.js/styles/atom-one-dark.css'
import {API_BASE_URL} from './constants/config'

const rawFetch = window.fetch.bind(window)
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
  const shouldAttachCredentials = url.startsWith(API_BASE_URL) || url.startsWith('/api/')
  if (!shouldAttachCredentials) {
    return rawFetch(input, init)
  }
  return rawFetch(input, {
    ...init,
    credentials: init?.credentials || 'include',
  })
}

const app = createApp(App)

const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
