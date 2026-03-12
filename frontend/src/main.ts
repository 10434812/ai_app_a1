import {createApp} from 'vue'
import {createPinia} from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import router from './router'
import App from './App.vue'
import './styles.css'
import 'highlight.js/styles/atom-one-dark.css'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate as any)

app.use(pinia)
app.use(router as any)

app.mount('#app')
