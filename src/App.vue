<script setup lang="ts">
import {computed, onMounted, ref, shallowRef, unref, useTemplateRef} from 'vue'
import {DataSet} from 'vis-data/peer'
import {Network, Options} from 'vis-network/peer'

import {useDataStore} from './dataStore'
import {LastFm, Navidrome} from './services'
import {useUserStore} from './userStore'
import {storeToRefs} from 'pinia'

const container = useTemplateRef('container')
const store = useDataStore()
const network = shallowRef<Network>()
const options: Options = {
  nodes: {
    shape: 'dot',
  },
  edges: {
    smooth: false,
  },
  physics: {
    barnesHut: {
      springLength: 110,
      avoidOverlap: 0.5,
      gravitationalConstant: -5000,
      damping: 0.3,
    },
  },
  layout: {
    improvedLayout: false,
  },
}

onMounted(() => {
  if (!container.value) return
  network.value = new Network(container.value, {}, options)
})

const status = ref<string>()
const checkConnections = async () => {
  const user = useUserStore()

  status.value = 'establishing...'

  try {
    await Navidrome.getArtists(user.navidromeApiBase, user.login, user.password)
  } catch (e) {
    status.value = `failed! Unable to connect to Navidrome: ${e}`
    return
  }

  try {
    await LastFm.getSimilarArtists('Queen', user.lastFmApiKey)
  } catch (e) {
    status.value = `failed! Unable to connect to LastFM: ${e}`
    return
  }

  status.value = 'OK'
}

const loadData = async () => {
  await store.requestAllData()
  network.value?.setData({
    nodes: new DataSet(unref(store.nodes)),
    edges: new DataSet(unref(store.edges)),
  })
  network.value?.setOptions(options)
}

const loading = computed(() => store.loading)

const {login, password, navidromeApiBase, lastFmApiKey} = storeToRefs(
  useUserStore()
)
</script>

<template>
  <div class="app-wrapper">
    <div
      class="container"
      ref="container"
    />
    <div class="handles">
      <div class="input-field">
        <label>Navidrome API base:</label>
        <input v-model="navidromeApiBase" />
      </div>
      <div class="input-field">
        <label>Login:</label>
        <input v-model="login" />
      </div>
      <div class="input-field">
        <label>Password:</label>
        <input
          type="password"
          v-model="password"
        />
      </div>
      <div class="input-field">
        <label>LastFm API key:</label>
        <input v-model="lastFmApiKey" />
      </div>

      <button @click="checkConnections">Check connections</button>
      <span
        v-if="status"
        :style="{color: status == 'OK' ? 'green' : 'red'}"
      >
        Connection is {{ status }}
      </span>

      <button @click="loadData">Load data</button>
      <span v-if="loading">
        Loading, {{ store.similaritiesQueue.length }} remaining...
      </span>
    </div>
  </div>
</template>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: row;
  gap: 8px;
  width: 100vw;
  height: 100vh;
  padding: 8px;
}

.container {
  flex-basis: 75%;
  border: 1px solid lightgray;
}

.handles {
  border: 1px solid lightgray;
  flex-basis: 25%;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-field {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
</style>
