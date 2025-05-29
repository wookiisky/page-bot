// Quick Inputs Manager
// Handles quick input buttons management

export class QuickInputsManager {
  
  // Add a new quick input
  static addQuickInput(domElements, displayText = '', sendText = '') {
    // Clone the template
    const template = domElements.quickInputTemplate.content.cloneNode(true);
    
    // Set values if provided
    if (displayText) {
      template.querySelector('.quick-input-display').value = displayText;
    }
    
    if (sendText) {
      template.querySelector('.quick-input-send').value = sendText;
    }
    
    // Add to container
    domElements.quickInputsContainer.appendChild(template);
  }
  
  // Remove a quick input
  static removeQuickInput(item) {
    item.remove();
  }
  
  // Get all quick inputs as an array
  static getQuickInputs(domElements) {
    const items = domElements.quickInputsContainer.querySelectorAll('.quick-input-item');
    const quickInputs = [];
    
    items.forEach(item => {
      const displayText = item.querySelector('.quick-input-display').value.trim();
      const sendText = item.querySelector('.quick-input-send').value.trim();
      
      if (displayText && sendText) {
        quickInputs.push({
          displayText,
          sendText
        });
      }
    });
    
    return quickInputs;
  }
  
  // Render quick inputs from config
  static renderQuickInputs(quickInputs, domElements) {
    // Clear existing quick inputs
    domElements.quickInputsContainer.innerHTML = '';
    
    // Add each quick input
    quickInputs.forEach(input => {
      this.addQuickInput(domElements, input.displayText, input.sendText);
    });
    
    // Add an empty one if none exist
    if (quickInputs.length === 0) {
      this.addQuickInput(domElements);
    }
  }
  
  // Set up event listeners for quick inputs
  static setupEventListeners(domElements) {
    // Add quick input button
    domElements.addQuickInputBtn.addEventListener('click', () => {
      this.addQuickInput(domElements);
    });
    
    // Quick input remove button delegation
    domElements.quickInputsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-quick-input-btn')) {
        this.removeQuickInput(e.target.closest('.quick-input-item'));
      }
    });
  }
} 