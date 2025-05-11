import {acceptHMRUpdate, defineStore} from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    navidromeInstance: '',
    login: '',
    password: '',
    lastFmApiKey: '',
  }),
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUserStore, import.meta.hot))
}
