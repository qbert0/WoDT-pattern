<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
useHead({
  title: 'Smart Home Dashboard',
  meta: [
    {
      name: 'description',
      content: 'Eclipse Ditto Dashboard'
    }
  ]
})
</script>