// Model Manager
// Handles multiple LLM model configurations with drag-and-drop support

// Import logger module
const logger = window.logger ? window.logger.createModuleLogger('ModelManager') : console;

export class ModelManager {
  constructor(domElements, autoSaveCallback = null) {
    this.domElements = domElements;
    this.models = [];
    this.draggedItem = null;
    this.autoSaveCallback = autoSaveCallback;
    this.setupDragAndDrop();
  }

  // Initialize model configurations
  init(config, autoSaveCallback = null) {
    this.models = config.llm?.models || [];
    if (autoSaveCallback) {
      this.autoSaveCallback = autoSaveCallback;
    }
    this.renderModels();
    this.updateDefaultModelSelector();
  }

  // Render all model configurations
  renderModels() {
    const container = this.domElements.modelsContainer;
    container.innerHTML = '';

    this.models.forEach((model, index) => {
      const modelElement = this.createModelElement(model, index);
      container.appendChild(modelElement);
    });

    // Setup event listeners for the newly created elements
    this.setupModelEventListeners();
    
    // Setup the inline add button event listener
    this.setupAddButtonListener();
  }

  // Create a single model configuration element
  createModelElement(model, index) {
    const div = document.createElement('div');
    div.className = `model-config-item ${!model.enabled ? 'disabled' : ''}`;
    div.draggable = true;
    div.dataset.index = index;

    // Create three columns: drag-handle, details, actions
    div.innerHTML = `
      <div class="drag-handle-column">
        <div class="drag-handle">
          <i class="material-icons">drag_indicator</i>
        </div>
      </div>
      <div class="model-details-column">
        <div class="model-form">
          <div class="form-grid">
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" class="model-name-input" value="${model.name || ''}"
                     data-model-index="${index}" data-field="name">
            </div>
            <div class="form-group">
              <label>Provider</label>
              <select class="model-provider-select"
                      data-model-index="${index}">
                <option value="openai" ${model.provider === 'openai' ? 'selected' : ''}>OpenAI Compatible</option>
                <option value="gemini" ${model.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
              </select>
            </div>
          </div>
          <div class="form-grid-single">
            <div class="form-group">
              <label>API Key</label>
              <input type="password" class="model-api-key" value="${model.apiKey || ''}"
                     data-model-index="${index}" data-field="apiKey">
            </div>
          </div>
          <div class="form-grid-single model-specific-fields" id="model-specific-${index}">
            ${this.renderModelSpecificFields(model, index)}
          </div>
        </div>
      </div>
      <div class="model-actions-column">
        <label class="toggle-switch">
          <input type="checkbox" ${model.enabled ? 'checked' : ''}
                 data-model-index="${index}" class="model-toggle">
          <span class="slider round"></span>
        </label>
        <button type="button" class="remove-model-btn icon-btn"
                data-model-index="${index}" title="Remove Model">
          <i class="material-icons">delete</i>
        </button>
      </div>
    `;
    return div;
  }

  // Render model-specific fields
  renderModelSpecificFields(model, index) {
    if (model.provider === 'openai') {
      return `
        <div class="form-grid">
          <div class="form-group">
            <label>Base URL</label>
            <input type="text" class="model-base-url" value="${model.baseUrl || 'https://api.openai.com'}"
                   data-model-index="${index}" data-field="baseUrl">
          </div>
          <div class="form-group">
            <label>Model</label>
            <input type="text" class="model-model" value="${model.model || 'gpt-3.5-turbo'}"
                   data-model-index="${index}" data-field="model">
          </div>
        </div>
      `;
    } else if (model.provider === 'gemini') {
      return `
        <div class="form-grid-single">
          <div class="form-group">
            <label>Model</label>
            <input type="text" class="model-model" value="${model.model || 'gemini-pro'}"
                   data-model-index="${index}" data-field="model">
          </div>
        </div>
      `;
    }
    return '';
  }

  // Setup inline add button event listener
  setupAddButtonListener() {
    const addButton = document.getElementById('addModelBtn');
    if (addButton) {
      // Remove any existing event listeners to avoid duplicates
      addButton.replaceWith(addButton.cloneNode(true));
      const newAddButton = document.getElementById('addModelBtn');
      newAddButton.addEventListener('click', () => this.addNewModel());
    }
  }

  // Add a new model configuration
  addNewModel() {
    const newModel = {
      id: `model-${Date.now()}`,
      name: `New Model ${this.models.length + 1}`,
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-3.5-turbo',
      enabled: true
    };

    this.models.push(newModel);
    this.renderModels();
    this.updateDefaultModelSelector();
    logger.info('Added new model configuration');
    // Don't auto-save new model until it's properly configured
  }

  // Remove a model configuration
  removeModel(index) {
    if (confirm('Are you sure you want to remove this model configuration?')) {
      this.models.splice(index, 1);
      this.renderModels();
      this.updateDefaultModelSelector();
      logger.info(`Removed model configuration at index ${index}`);
      if (this.autoSaveCallback) {
        this.autoSaveCallback();
      }
    }
  }

  // Toggle model enabled state
  toggleModel(index, enabled) {
    this.models[index].enabled = enabled;
    this.renderModels();
    this.updateDefaultModelSelector();
    logger.info(`Toggled model ${index} enabled state to ${enabled}`);
    if (this.autoSaveCallback && this.isModelComplete(this.models[index])) {
      this.autoSaveCallback();
    }
  }

  // Update a model field
  updateModelField(index, field, value) {
    this.models[index][field] = value;
    if (field === 'name') {
      this.updateDefaultModelSelector();
    }
    logger.debug(`Updated model ${index} field ${field} to ${value}`);
    if (this.autoSaveCallback && this.isModelComplete(this.models[index])) {
      this.autoSaveCallback();
    }
  }

  // Update model provider and re-render specific fields
  updateModelProvider(index, provider) {
    this.models[index].provider = provider;
    
    // Set default values for the new provider
    if (provider === 'openai') {
      this.models[index].baseUrl = this.models[index].baseUrl || 'https://api.openai.com';
      this.models[index].model = this.models[index].model || 'gpt-3.5-turbo';
    } else if (provider === 'gemini') {
      this.models[index].model = this.models[index].model || 'gemini-pro';
      delete this.models[index].baseUrl; // Remove baseUrl for Gemini
    }

    this.renderModels();
    logger.info(`Updated model ${index} provider to ${provider}`);
    if (this.autoSaveCallback && this.isModelComplete(this.models[index])) {
      this.autoSaveCallback();
    }
  }

  // Check if a model has all required fields filled
  isModelComplete(model) {
    if (!model.name || !model.apiKey || !model.model) {
      return false;
    }
    
    if (model.provider === 'openai' && !model.baseUrl) {
      return false;
    }
    
    return true;
  }

  // Get all complete model configurations (only models with all required fields)
  getCompleteModels() {
    return this.models.filter(model => this.isModelComplete(model));
  }

  // Update the default model selector dropdown
  updateDefaultModelSelector() {
    const selector = this.domElements.defaultModelSelect;
    if (!selector) return;

    const currentValue = selector.value;
    selector.innerHTML = '';

    // Add enabled models to the selector
    this.models.forEach(model => {
      if (model.enabled) {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name || `${model.provider} - ${model.model}`;
        selector.appendChild(option);
      }
    });

    // Restore selected value if it still exists
    if (currentValue && Array.from(selector.options).some(opt => opt.value === currentValue)) {
      selector.value = currentValue;
    } else if (selector.options.length > 0) {
      selector.value = selector.options[0].value;
    }
  }

  // Setup event listeners for model elements
  setupModelEventListeners() {
    const container = this.domElements.modelsContainer;

    // Model toggle switches
    container.querySelectorAll('.model-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.modelIndex);
        this.toggleModel(index, e.target.checked);
      });
    });

    // Remove model buttons
    container.querySelectorAll('.remove-model-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('button').dataset.modelIndex);
        this.removeModel(index);
      });
    });

    // Model input fields
    container.querySelectorAll('input[data-field], select.model-provider-select').forEach(input => {
      if (input.classList.contains('model-provider-select')) {
        // Handle provider select change
        input.addEventListener('change', (e) => {
          const index = parseInt(e.target.dataset.modelIndex);
          this.updateModelProvider(index, e.target.value);
        });
      } else {
        // Handle regular field updates on change
        input.addEventListener('change', (e) => {
          const index = parseInt(e.target.dataset.modelIndex);
          const field = e.target.dataset.field;
          this.updateModelField(index, field, e.target.value);
        });
        
        // Handle real-time updates on input for text fields
        if (input.type === 'text' || input.type === 'password') {
          input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.modelIndex);
            const field = e.target.dataset.field;
            this.updateModelField(index, field, e.target.value);
          });
        }
      }
    });
  }

  // Setup drag and drop functionality
  setupDragAndDrop() {
    // We'll set up event listeners after the DOM is rendered
    setTimeout(() => {
      this.attachDragListeners();
    }, 100);
  }

  // Attach drag and drop event listeners
  attachDragListeners() {
    const container = this.domElements.modelsContainer;
    if (!container) return;

    container.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('model-config-item')) {
        this.draggedItem = e.target;
        e.target.style.opacity = '0.5';
        e.target.classList.add('dragging');
      }
    });

    container.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('model-config-item')) {
        e.target.style.opacity = '1';
        e.target.classList.remove('dragging');
        this.draggedItem = null;
      }
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.draggedItem) return;
      
      const afterElement = this.getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        // Find the add button and insert before it
        const addButton = container.querySelector('.add-model-btn');
        if (addButton) {
          container.insertBefore(this.draggedItem, addButton);
        }
      } else {
        container.insertBefore(this.draggedItem, afterElement);
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      this.reorderModels();
    });
  }

  // Get the element after which the dragged item should be inserted
  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.model-config-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Reorder models array based on DOM order
  reorderModels() {
    const container = this.domElements.modelsContainer;
    const modelElements = container.querySelectorAll('.model-config-item');
    const newOrder = [];

    modelElements.forEach(element => {
      const index = parseInt(element.dataset.index);
      if (!isNaN(index) && this.models[index]) {
        newOrder.push(this.models[index]);
      }
    });

    if (newOrder.length === this.models.length) {
      this.models = newOrder;
      this.renderModels();
      logger.info('Reordered model configurations');
      if (this.autoSaveCallback) {
        this.autoSaveCallback();
      }
    } else {
      logger.warn('Model reordering failed: length mismatch');
      this.renderModels(); // Re-render to restore original order
    }
  }

  // Get all model configurations
  getModels() {
    return this.models;
  }

  // Get the selected default model ID
  getDefaultModelId() {
    return this.domElements.defaultModelSelect?.value || '';
  }
}

// Note: Removed global window.modelManager to comply with CSP 