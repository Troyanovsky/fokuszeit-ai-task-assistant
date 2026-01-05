<!-- Settings view for AI configuration and scheduling preferences. -->
<template>
  <div class="settings-view h-full overflow-y-auto p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Settings</h1>
      <router-link to="/" class="text-gray-600 hover:text-gray-900">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </router-link>
    </div>

    <!-- AI Service Settings -->
    <div class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 class="text-xl font-semibold mb-4">AI Assistant Settings</h2>

      <form class="space-y-4" @submit.prevent="saveAISettings">
        <div class="form-group">
          <label for="apiKey" class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            id="apiKey"
            v-model="apiKey"
            type="password"
            class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your API key"
          />
        </div>

        <div class="form-group">
          <label for="apiUrl" class="block text-sm font-medium text-gray-700 mb-1">API URL</label>
          <input
            id="apiUrl"
            v-model="apiUrl"
            type="text"
            class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="API endpoint URL"
          />
        </div>

        <div class="form-group">
          <label for="model" class="block text-sm font-medium text-gray-700 mb-1">Model</label>
          <input
            id="model"
            v-model="model"
            type="text"
            class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Model name"
          />
        </div>

        <div class="flex items-center justify-between">
          <button
            type="submit"
            class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            Save Settings
          </button>

          <div
            v-if="aiSaveStatus"
            class="text-sm"
            :class="{
              'text-green-500': aiSaveStatus === 'success',
              'text-red-500': aiSaveStatus === 'error',
            }"
          >
            {{ aiStatusMessage }}
          </div>
        </div>
      </form>
    </div>

    <!-- Working Hours Settings -->
    <div class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 class="text-xl font-semibold mb-4">Working Hours & Task Scheduling</h2>

      <form class="space-y-4" @submit.prevent="saveWorkingHours">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-group">
            <label for="startTime" class="block text-sm font-medium text-gray-700 mb-1"
              >Start Time</label
            >
            <input
              id="startTime"
              v-model="startTime"
              type="time"
              class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="form-group">
            <label for="endTime" class="block text-sm font-medium text-gray-700 mb-1"
              >End Time</label
            >
            <input
              id="endTime"
              v-model="endTime"
              type="time"
              class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="bufferTime" class="block text-sm font-medium text-gray-700 mb-1"
            >Buffer Time Between Tasks (minutes)</label
          >
          <input
            id="bufferTime"
            v-model.number="bufferTime"
            type="number"
            min="0"
            max="120"
            class="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="10"
          />
          <p class="text-xs text-gray-500 mt-1">
            Time buffer added between scheduled tasks (0-120 minutes)
          </p>
        </div>

        <div class="flex items-center justify-between">
          <button
            type="submit"
            class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            Save Preferences
          </button>

          <div
            v-if="workingHoursSaveStatus"
            class="text-sm"
            :class="{
              'text-green-500': workingHoursSaveStatus === 'success',
              'text-red-500': workingHoursSaveStatus === 'error',
            }"
          >
            {{ workingHoursStatusMessage }}
          </div>
        </div>
      </form>
    </div>

    <!-- Other Application Settings -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4">Application Settings</h2>
      <p class="text-gray-500">Additional settings will be implemented in future phases</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'SettingsView',
  setup() {
    const store = useStore();

    // AI settings
    const apiKey = ref('');
    const apiUrl = ref('');
    const model = ref('');
    const aiSaveStatus = ref('');
    const aiStatusMessage = ref('');

    // Working hours settings
    const startTime = ref('10:00');
    const endTime = ref('19:00');
    const bufferTime = ref(10);
    const workingHoursSaveStatus = ref('');
    const workingHoursStatusMessage = ref('');

    // Load current settings
    onMounted(() => {
      // Load AI settings
      store.dispatch('ai/loadSettings').then(() => {
        apiKey.value = store.getters['ai/apiKey'] || '';
        apiUrl.value = store.getters['ai/apiUrl'] || 'https://api.openai.com/v1/chat/completions';
        model.value = store.getters['ai/model'] || 'gpt-4o-mini';
      });

      // Load working hours settings
      store.dispatch('preferences/loadPreferences').then(() => {
        startTime.value = store.getters['preferences/startTime'] || '10:00';
        endTime.value = store.getters['preferences/endTime'] || '19:00';
        bufferTime.value = store.getters['preferences/bufferTime'] || 10;
      });
    });

    // Save AI settings
    const saveAISettings = async () => {
      try {
        const success = await store.dispatch('ai/configureAI', {
          apiKey: apiKey.value,
          apiUrl: apiUrl.value,
          model: model.value,
        });

        if (success) {
          aiSaveStatus.value = 'success';
          aiStatusMessage.value = 'Settings saved successfully!';
        } else {
          aiSaveStatus.value = 'error';
          aiStatusMessage.value = 'Failed to save settings.';
        }
      } catch (error) {
        aiSaveStatus.value = 'error';
        aiStatusMessage.value = `Error: ${error.message}`;
      }

      // Clear status after 3 seconds
      setTimeout(() => {
        aiSaveStatus.value = '';
        aiStatusMessage.value = '';
      }, 3000);
    };

    // Save working hours settings
    const saveWorkingHours = async () => {
      try {
        // Validate buffer time
        if (bufferTime.value < 0 || bufferTime.value > 120) {
          workingHoursSaveStatus.value = 'error';
          workingHoursStatusMessage.value = 'Buffer time must be between 0 and 120 minutes.';
          return;
        }

        // Save working hours
        const workingHoursSuccess = await store.dispatch('preferences/updateWorkingHours', {
          startTime: startTime.value,
          endTime: endTime.value,
        });

        // Save buffer time
        const bufferTimeSuccess = await store.dispatch(
          'preferences/updateBufferTime',
          bufferTime.value
        );

        if (workingHoursSuccess && bufferTimeSuccess) {
          workingHoursSaveStatus.value = 'success';
          workingHoursStatusMessage.value = 'Settings saved successfully!';
        } else {
          workingHoursSaveStatus.value = 'error';
          workingHoursStatusMessage.value = 'Failed to save settings.';
        }
      } catch (error) {
        workingHoursSaveStatus.value = 'error';
        workingHoursStatusMessage.value = `Error: ${error.message}`;
      }

      // Clear status after 3 seconds
      setTimeout(() => {
        workingHoursSaveStatus.value = '';
        workingHoursStatusMessage.value = '';
      }, 3000);
    };

    return {
      apiKey,
      apiUrl,
      model,
      saveAISettings,
      aiSaveStatus,
      aiStatusMessage,

      startTime,
      endTime,
      bufferTime,
      saveWorkingHours,
      workingHoursSaveStatus,
      workingHoursStatusMessage,
    };
  },
};
</script>
