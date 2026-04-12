import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import { useAuth } from './composables/useAuth'
import { initializeClientState } from './lib/appState'
import { syncPendingLogs } from './services/sync.service'

const app = createApp(App)

app.use(createPinia())
app.use(router)

const { initialize } = useAuth()

initializeClientState()

initialize()
  .finally(() => {
    app.mount('#app')
    void syncPendingLogs()
  })
