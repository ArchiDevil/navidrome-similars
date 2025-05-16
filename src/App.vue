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
    await Navidrome.getArtists(
      user.navidromeInstance,
      user.login,
      user.password
    )
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

const {login, password, navidromeInstance, lastFmApiKey} = storeToRefs(
  useUserStore()
)

const {similarityMatchThreshold, showOrphans, enableCache} = storeToRefs(
  useDataStore()
)
</script>

<template>
  <div class="app-wrapper flex flex-row gap-2 p-2 text-slate-900 w-dvw h-dvh">
    <div
      class="basis-3/4 border-slate-300 border border-solid rounded-2xl bg-slate-50"
      ref="container"
    />
    <div
      class="basis-1/4 flex flex-col gap-2 p-2 border-slate-300 border border-solid rounded-2xl bg-slate-50"
    >
      <div class="flex flex-col gap-1">
        <h2 class="font-semibold mt-1 mb-0 text-xl">Credentials</h2>
        <div class="flex flex-col mb-2">
          <label class="mb-0.5 text-sm"
            >Your Navidrome server (https://example.com/):</label
          >
          <input
            class="text-sm bg-slate-50 border rounded-md border-slate-500 px-1 py-0.5"
            v-model="navidromeInstance"
          />
        </div>
        <div class="flex flex-col mb-2">
          <label class="mb-0.5 text-sm">Login:</label>
          <input
            class="text-sm bg-slate-50 border rounded-md border-slate-500 px-1 py-0.5"
            v-model="login"
          />
        </div>
        <div class="flex flex-col mb-2">
          <label class="mb-0.5 text-sm">Password:</label>
          <input
            class="text-sm bg-slate-50 border rounded-md border-slate-500 px-1 py-0.5"
            type="password"
            v-model="password"
          />
        </div>
        <div class="flex flex-col mb-2">
          <label class="mb-0.5 text-sm">LastFM API key:</label>
          <input
            class="text-sm bg-slate-50 border rounded-md border-slate-500 px-1 py-0.5"
            v-model="lastFmApiKey"
          />
        </div>
        <button
          class="text-sm bg-slate-500 text-slate-50 rounded-md p-1 hover:bg-slate-400 transition-colors cursor-pointer"
          @click="checkConnections"
        >
          Check connections
        </button>
        <span
          v-if="status"
          class="text-sm mb-0.5"
          :class="{
            'text-green-700': status === 'OK',
            'text-red-700': status !== 'OK',
          }"
        >
          Connection is {{ status }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <h2 class="font-semibold mt-1 mb-0 text-xl">Graph settings</h2>
        <div class="flex flex-col mb-2">
          <label class="mb-0.5 text-sm">Similarity threshold:</label>
          <input
            class="text-sm bg-slate-50 border rounded-md border-slate-500 px-1 py-0.5"
            type="number"
            min="0.05"
            max="0.95"
            step="0.05"
            v-model="similarityMatchThreshold"
          />
        </div>
        <div class="flex flex-row items-center gap-1">
          <label class="mb-0.5 text-sm">
            Show not found artists (extremely slow):
          </label>
          <input
            type="checkbox"
            v-model="showOrphans"
          />
        </div>
        <div class="flex flex-row items-center gap-1">
          <label class="mb-0.5 text-sm">
            Enable cache (disable if you have a lot of artists):
          </label>
          <input
            type="checkbox"
            v-model="enableCache"
          />
        </div>
        <button
          class="text-sm bg-slate-500 text-slate-50 rounded-md p-1 hover:bg-slate-400 transition-colors cursor-pointer disabled:bg-slate-300"
          @click="loadData"
          :disabled="store.loading"
        >
          <template v-if="!store.loading">Load data</template>
          <template v-else>
            Loading,
            {{ store.similaritiesQueue.length }} remaining...
          </template>
        </button>
      </div>
      <div
        v-if="selectedNode && selectedArtist"
        class="flex flex-col gap-1 overflow-y-scroll"
      >
        <h2 class="font-medium mt-1 mb-0 text-xl">
          {{ selectedNode }} ({{ selectedArtist.albumCount }} albums)
        </h2>
        <span
          v-if="selectedArtist && selectedArtist.mbid"
          class="text-sm mb-0.5"
          >MBID:
          <a
            class="text-sm underline hover:decoration-2"
            :href="`https://musicbrainz.org/artist/${selectedArtist.mbid}`"
            target="_blank"
            >{{ selectedArtist?.mbid }}</a
          >
        </span>
        <span
          v-for="sim in similarities"
          class="text-sm mb-0.5"
          :class="{
            'text-slate-400': sim.match < similarityMatchThreshold,
          }"
        >
          {{ Number(sim.match).toFixed(2) }}: {{ sim.artist }}
        </span>
      </div>
    </div>
  </div>
</template>
