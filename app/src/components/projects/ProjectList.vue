<template>
  <div class="project-list">
    <div class="mb-4 flex justify-between items-center">
      <!-- <h3 class="text-lg font-semibold">Projects</h3> -->
    </div>

    <!-- Smart Projects Section -->
    <div class="mb-4">
      <h4 class="text-sm text-gray-500 font-medium mb-2">Smart Projects</h4>
      <div class="space-y-2">
        <div
          class="p-3 rounded cursor-pointer flex justify-between items-center"
          :class="
            selectedSmartProject === 'today'
              ? 'bg-blue-100 border-blue-300 border'
              : 'bg-white border-gray-200 border hover:bg-gray-50'
          "
          @click="selectSmartProject('today')"
        >
          <div class="flex-1 min-w-0">
            <h4 class="font-medium truncate">Today</h4>
            <p class="text-sm text-gray-600 truncate max-w-xs">Tasks due or planned for today</p>
          </div>
        </div>
        <div
          class="p-3 rounded cursor-pointer flex justify-between items-center"
          :class="
            selectedSmartProject === 'overdue'
              ? 'bg-blue-100 border-blue-300 border'
              : 'bg-white border-gray-200 border hover:bg-gray-50'
          "
          @click="selectSmartProject('overdue')"
        >
          <div class="flex-1 min-w-0">
            <h4 class="font-medium truncate">Overdue</h4>
            <p class="text-sm text-gray-600 truncate max-w-xs">Tasks that are past due date</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Your Projects Section -->
    <div class="mb-4">
      <h4 class="text-sm text-gray-500 font-medium mb-2">Your Projects</h4>
    </div>

    <!-- Project Form Dialog for Add -->
    <div v-if="showAddProjectForm && !editingProject" class="mb-4 p-3 bg-white rounded shadow-md">
      <project-form @save="addProject" @cancel="showAddProjectForm = false" />
    </div>

    <!-- Project Form Dialog for Edit -->
    <div v-if="editingProject" class="mb-4 p-3 bg-white rounded shadow-md">
      <project-form
        :project="editingProject"
        @save="updateProject"
        @cancel="editingProject = null"
      />
    </div>

    <!-- Projects List -->
    <div v-if="projects.length > 0" class="space-y-2 mb-2">
      <project-item
        v-for="project in projects"
        v-show="!editingProject || editingProject.id !== project.id"
        :key="project.id"
        :project="project"
        :is-selected="selectedProject && selectedProject.id === project.id && !selectedSmartProject"
        @click="selectProject(project)"
        @edit="editProject(project)"
        @delete="deleteProject(project.id)"
      />
    </div>
    <div v-else class="text-gray-500 text-sm mt-2 mb-2">
      No projects found. Create your first project.
    </div>

    <!-- Add Project Button at bottom -->
    <div
      class="p-3 rounded cursor-pointer bg-white border-gray-200 border hover:bg-gray-50 text-center text-blue-500"
      @click="showAddForm"
    >
      + Add Project
    </div>

    <!-- Loading Indicator -->
    <div v-if="isLoading" class="mt-4 text-center">
      <span class="text-gray-500">Loading projects...</span>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mt-4 text-center">
      <span class="text-red-500">{{ error }}</span>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import ProjectItem from './ProjectItem.vue';
import ProjectForm from './ProjectForm.vue';
import Project from '../../../shared/models/Project.js';
import logger from '../../services/logger.js';

export default {
  name: 'ProjectList',
  components: {
    ProjectItem,
    ProjectForm,
  },
  emits: ['project-selected', 'smart-project-selected'],
  setup(props, { emit }) {
    const store = useStore();
    const showAddProjectForm = ref(false);
    const editingProject = ref(null);
    const selectedSmartProject = ref(null);

    // Store reference to the wrapped listener function for proper cleanup
    const wrappedProjectsRefreshListener = ref(null);

    // Get data from store using getters
    const projects = computed(() => store.getters['projects/allProjects']);
    const selectedProject = computed(() => store.getters['projects/selectedProject']);
    const isLoading = computed(() => store.getters['projects/isLoading']);
    const error = computed(() => store.getters['projects/error']);

    // Function to fetch projects
    const fetchProjects = async () => {
      await store.dispatch('projects/fetchProjects');

      // Select first project by default if available and none is selected
      if (projects.value.length > 0 && !selectedProject.value && !selectedSmartProject.value) {
        selectProject(projects.value[0]);
      }
    };

    onMounted(async () => {
      // Fetch projects on component mount
      await fetchProjects();

      // Also fetch all tasks for smart projects
      await store.dispatch('tasks/fetchTasks');

      // Listen for project refresh events from main process
      try {
        if (window.electron && window.electron.receive) {
          wrappedProjectsRefreshListener.value = window.electron.receive(
            'projects:refresh',
            async () => {
              logger.info('Received projects:refresh event');
              await fetchProjects();
            }
          );
        } else {
          logger.warn('Electron API not available - project refresh events will not work');
        }
      } catch (error) {
        logger.logError(error, 'Error setting up project refresh listener');
      }
    });

    onBeforeUnmount(() => {
      // Remove specific event listener when component is unmounted
      try {
        if (window.electron && wrappedProjectsRefreshListener.value) {
          window.electron.removeListener('projects:refresh', wrappedProjectsRefreshListener.value);
          wrappedProjectsRefreshListener.value = null;
        }
      } catch (error) {
        logger.logError(error, 'Error removing project refresh listener');
      }
    });

    const selectProject = (project) => {
      // Clear smart project selection
      selectedSmartProject.value = null;

      store.dispatch('projects/selectProject', project);
      emit('project-selected', project);
    };

    const selectSmartProject = (type) => {
      // Clear regular project selection
      store.dispatch('projects/selectProject', null);

      selectedSmartProject.value = type;
      emit('smart-project-selected', type);
    };

    const addProject = async (projectData) => {
      await store.dispatch('projects/addProject', projectData);
      showAddProjectForm.value = false;
    };

    const updateProject = async (projectData) => {
      await store.dispatch('projects/updateProject', new Project(projectData));
      editingProject.value = null;
    };

    const editProject = (project) => {
      // Close add form if it's open
      showAddProjectForm.value = false;
      editingProject.value = project;
    };

    const deleteProject = async (projectId) => {
      if (confirm('Are you sure you want to delete this project?')) {
        await store.dispatch('projects/deleteProject', projectId);

        // If deleted project was selected, select another project
        if (selectedProject.value && selectedProject.value.id === projectId) {
          if (projects.value.length > 0) {
            selectProject(projects.value[0]);
          }
        }
      }
    };

    const showAddForm = () => {
      // Close edit form if it's open
      editingProject.value = null;
      showAddProjectForm.value = true;
    };

    return {
      projects,
      selectedProject,
      selectedSmartProject,
      showAddProjectForm,
      editingProject,
      isLoading,
      error,
      selectProject,
      selectSmartProject,
      addProject,
      updateProject,
      editProject,
      deleteProject,
      showAddForm,
    };
  },
};
</script>
