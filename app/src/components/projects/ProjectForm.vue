<!-- Project form for creating and editing projects. -->
<template>
  <div class="project-form">
    <h3 class="text-lg font-medium mb-3">{{ project ? 'Edit Project' : 'Add Project' }}</h3>
    <form @submit.prevent="saveProject">
      <div class="mb-3">
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div class="mb-4">
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1"
          >Description</label
        >
        <textarea
          id="description"
          v-model="formData.description"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        ></textarea>
      </div>

      <div class="flex justify-end space-x-2">
        <button
          type="button"
          class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {{ project ? 'Update' : 'Create' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { reactive, onMounted } from 'vue';

export default {
  name: 'ProjectForm',
  props: {
    project: {
      type: Object,
      default: null,
    },
  },
  emits: ['save', 'cancel'],
  setup(props, { emit }) {
    const formData = reactive({
      name: '',
      description: '',
    });

    onMounted(() => {
      if (props.project) {
        formData.name = props.project.name;
        formData.description = props.project.description || '';
      }
    });

    const saveProject = () => {
      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      if (props.project) {
        projectData.id = props.project.id;
      }

      emit('save', projectData);

      // Reset form after submission
      formData.name = '';
      formData.description = '';
    };

    return {
      formData,
      saveProject,
    };
  },
};
</script>
