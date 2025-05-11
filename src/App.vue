<script setup lang="ts">
import {computed, onMounted, ref, shallowRef, unref, useTemplateRef} from 'vue'
import {DataSet} from 'vis-data/peer'
import {Network, Options} from 'vis-network/peer'
import {storeToRefs} from 'pinia'

import {useDataStore} from './dataStore'
import {LastFm, Navidrome} from './services'
import {useUserStore} from './userStore'

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

const selectedNode = ref<string>()
const selectedArtist = computed(() =>
  selectedNode.value ? store.artists.get(selectedNode.value ?? '') : undefined
)
const similarities = computed(() =>
  selectedNode.value
    ? store.similarities.get(selectedNode.value ?? '')
    : undefined
)

onMounted(() => {
  if (!container.value) return
  network.value = new Network(container.value, {}, options)
  network.value.on('selectNode', (params) => {
    const selectedId = params.nodes[0]
    const node = store.nodes.find((node) => node.id === selectedId)
    selectedNode.value = node?.label ?? 'unknown'
  })
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

const {similarityMatchThreshold} = storeToRefs(useDataStore())
</script>

<template>
  <div class="app-wrapper">
    <div
      class="container"
      ref="container"
    />
    <div class="settings">
      <h1>Settings</h1>
      <div class="handles">
        <h2>Credentials</h2>
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
          <label>LastFM API key:</label>
          <input v-model="lastFmApiKey" />
        </div>

        <button @click="checkConnections">Check connections</button>
        <span
          v-if="status"
          :style="{color: status == 'OK' ? 'green' : 'red'}"
        >
          Connection is {{ status }}
        </span>
      </div>
      <div class="handles">
        <h2>Graph settings</h2>
        <button @click="loadData">Load data</button>
        <span v-if="loading">
          Loading, {{ store.similaritiesQueue.length }} remaining...
        </span>
        <div class="input-field">
          <label>Similarity threshold:</label>
          <input
            type="number"
            min="0.05"
            max="0.95"
            step="0.05"
            v-model="similarityMatchThreshold"
          />
        </div>
      </div>
      <div
        v-if="selectedNode && selectedArtist"
        class="handles"
        style="overflow-y: scroll"
      >
        <h2>{{ selectedNode }}</h2>
        <span>ID: {{ selectedArtist?.id }}</span>
        <span>MBID: {{ selectedArtist?.mbid }}</span>
        <span>Albums: {{ selectedArtist?.albumCount }}</span>
        <span
          v-for="sim in similarities"
          :style="{
            color: sim.match > similarityMatchThreshold ? '#000000' : '#AAAAAA',
          }"
        >
          {{ Number(sim.match).toFixed(2) }}: {{ sim.artist }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@font-face {
  font-family: 'Inter';
  src: url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
}

.app-wrapper {
  font-family: 'Inter', sans-serif;

  display: flex;
  flex-direction: row;
  gap: 8px;
  width: 100vw;
  height: 100vh;
  padding: 8px;
}

button {
  font-size: 0.875rem;
  font-family: 'Inter', sans-serif;
}

span,
label {
  font-size: 0.875rem;
  margin-bottom: 2px;
}

input {
  font-family: 'Inter', sans-serif;
}

.settings {
  flex-basis: 25%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid lightgray;
  padding: 8px;
}

.container {
  flex-basis: 75%;
  border: 1px solid lightgray;
}

.handles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-field {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

h1,
h2 {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
}

h1 {
  margin-top: 8px;
  margin-bottom: 0px;
  font-size: 1.75rem;
}

h2 {
  margin-top: 4px;
  margin-bottom: 0px;
  font-size: 1.25rem;
}
</style>
