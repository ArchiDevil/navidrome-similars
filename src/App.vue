<script setup lang="ts">
import {computed, onMounted, shallowRef, unref, useTemplateRef} from 'vue'
import {DataSet} from 'vis-data/peer'
import {Network} from 'vis-network/peer'
import {useDataStore} from './dataStore'

const container = useTemplateRef('network')
const store = useDataStore()
const network = shallowRef<Network>()
const options = {
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
</script>

<template>
  <div class="app-wrapper">
    <div class="header">
      <button @click="loadData">Load data</button>
    </div>
    <div
      class="network"
      ref="network"
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

.network {
  width: 80%;
  height: 100%;
  border: 1px solid lightgray;
}
</style>
