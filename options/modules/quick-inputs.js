// Quick Inputs Manager
// Handles quick input buttons management

export class QuickInputsManager {
  
  /**
   * Generate a random unique ID for quick input tabs (consistent with config manager)
   * @returns {string} Random ID string
   */
  static generateRandomId() {
    return 'qi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Add a new quick input
  static addQuickInput(domElements, displayText = '', sendText = '', id = null) {
    // Clone the template
    const template = domElements.quickInputTemplate.content.cloneNode(true);
    
    // Set values if provided
    if (displayText) {
      template.querySelector('.quick-input-display').value = displayText;
    }
    
    if (sendText) {
      template.querySelector('.quick-input-send').value = sendText;
    }
    
    // Store ID in a hidden input for persistence
    const hiddenIdInput = document.createElement('input');
    hiddenIdInput.type = 'hidden';
    hiddenIdInput.className = 'quick-input-id';
    hiddenIdInput.value = id || this.generateRandomId();
    template.querySelector('.quick-input-item').appendChild(hiddenIdInput);
    
    // Add to container
    domElements.quickInputsContainer.appendChild(template);
  }
  
  // Remove a quick input
  static removeQuickInput(item) {
    item.remove();
  }
  
  // Get all quick inputs as an array (ensuring IDs are preserved)
  static getQuickInputs(domElements) {
    const items = domElements.quickInputsContainer.querySelectorAll('.quick-input-item');
    const quickInputs = [];
    
    items.forEach(item => {
      const displayText = item.querySelector('.quick-input-display').value.trim();
      const sendText = item.querySelector('.quick-input-send').value.trim();
      const idInput = item.querySelector('.quick-input-id');
      
      if (displayText && sendText) {
        quickInputs.push({
          id: idInput ? idInput.value : this.generateRandomId(),
          displayText,
          sendText
        });
      }
    });
    
    return quickInputs;
  }
  
  // Render quick inputs from config (preserving existing IDs)
  static renderQuickInputs(quickInputs, domElements) {
    // Clear existing quick inputs
    domElements.quickInputsContainer.innerHTML = '';
    
    // Add each quick input (they should already have IDs from storage)
    quickInputs.forEach(input => {
      // Ensure ID exists for backward compatibility
      const id = input.id || this.generateRandomId();
      this.addQuickInput(domElements, input.displayText, input.sendText, id);
    });
    
    // Add an empty one if none exist
    if (quickInputs.length === 0) {
      this.addQuickInput(domElements);
    }
  }
  
  // Set up event listeners for quick inputs
  static setupEventListeners(domElements, autoSaveCallback = null) {
    // Add quick input button
    domElements.addQuickInputBtn.addEventListener('click', () => {
      this.addQuickInput(domElements);
      if (autoSaveCallback) {
        autoSaveCallback();
      }
    });
    
    // Quick input remove button delegation
    domElements.quickInputsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-quick-input-btn') || 
          e.target.closest('.remove-quick-input-btn')) {
        this.removeQuickInput(e.target.closest('.quick-input-item'));
        if (autoSaveCallback) {
          autoSaveCallback();
        }
      }
    });
    
    // Auto-save on input changes for quick inputs
    if (autoSaveCallback) {
      domElements.quickInputsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('quick-input-display') || 
            e.target.classList.contains('quick-input-send')) {
          autoSaveCallback();
        }
      });
    }
  }
} 