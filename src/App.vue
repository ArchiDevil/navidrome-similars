<script setup lang="ts">
import {computed, onMounted, shallowRef, unref, useTemplateRef} from 'vue'
import {DataSet} from 'vis-data/peer'
import {Network, Options} from 'vis-network/peer'
import {useDataStore} from './dataStore'

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
    improvedLayout: false
  }
}

onMounted(() => {
  if (!container.value) return
  network.value = new Network(container.value, {}, options)
})

const loadData = async () => {
  await store.requestAllData()
  network.value?.setData({
    nodes: new DataSet(unref(store.nodes)),
    edges: new DataSet(unref(store.edges)),
  })
  network.value?.setOptions(options)
}

const loading = computed(() => store.loading)
</script>

<template>
  <div class="app-wrapper">
    <div class="header">
      <button @click="loadData">Load data</button>
      <span v-if="loading">
        Loading, {{ store.similaritiesQueue.length }} remaining...
      </span>
    </div>
    <div
      class="container"
      ref="container"
    />
  </div>
</template>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  width: 100%;
  height: 100svh;
}

.header {
  width: 100%;
}

.container {
  width: 80%;
  height: 90%;
  border: 1px solid lightgray;
}
</style>
