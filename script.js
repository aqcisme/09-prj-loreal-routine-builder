/* ---------- Configuration ---------- */

const WORKER_URL = "https://summer-star-a341.ac7248a.workers.dev/";

const STORAGE_KEY = "loreal-selected-products";

const SYSTEM_PROMPT = `You are a product-aware L'Oréal Beauty Routine Advisor for a student demonstration project.

Your role:
- Create practical routines using the products the user selected.
- Use the selected product data supplied in the conversation, including brand, name, category, and description.
- Clearly explain product order, timing, frequency, and purpose.
- If the selected products do not form a complete routine, explain what steps are missing without inventing products or claiming the user selected something they did not.
- Answer follow-up questions about the generated routine, selected products, skincare, haircare, makeup, fragrance, suncare, hair color, hair styling, and men's grooming.
- Politely refuse unrelated requests and redirect the user to their routine or beauty-related topics.

Safety:
- Do not diagnose or treat medical conditions.
- Encourage patch testing and following product labels.
- For severe irritation, allergic reactions, persistent acne, hair loss, or other medical concerns, recommend consulting a qualified healthcare professional.
- Do not guarantee results.
- Do not invent product claims, ingredients, prices, shades, or availability.

Formatting:
- Return plain text only.
- Do not use Markdown symbols such as #, **, *, or backticks.
- Use short headings, numbered steps, and blank lines for readability.

Keep responses friendly, organized, useful, and reasonably concise.`;

/* ---------- DOM references ---------- */

const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsButton = document.getElementById("clearSelections");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");

/* ---------- Application state ---------- */

let allProducts = [];
let selectedProducts = [];
let routineGenerated = false;

let conversationHistory = [
  {
    role: "system",
    content: SYSTEM_PROMPT,
  },
];

/* ---------- Initial interface ---------- */

productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

appendMessage(
  "assistant",
  "Select products from the catalog, then click Generate Routine. After I build your routine, you can ask follow-up questions here.",
);

setChatEnabled(false);
renderSelectedProducts();


/* ---------- Product loading ---------- */

async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error(`Could not load products: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.products)) {
      throw new Error("The product file has an invalid format.");
    }

    allProducts = data.products;

    // Restore previously selected products
    restoreSelectedProducts();
    renderSelectedProducts();

    // Automatically select the skincare category
    categoryFilter.value = "skincare";

    // Display skincare products immediately
    const initialProducts = allProducts.filter(
      (product) => product.category === "skincare"
    );

    displayProducts(initialProducts);

  } catch (error) {
    console.error("Product loading error:", error);

    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Sorry, the products could not be loaded.
      </div>
    `;
  }
}

/* ---------- Product display ---------- */

function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products were found in this category.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some(
        (selectedProduct) => selectedProduct.id === product.id,
      );

      return `
        <article
          class="product-card ${isSelected ? "selected" : ""}"
          data-product-id="${product.id}"
          tabindex="0"
          aria-label="${isSelected ? "Unselect" : "Select"} ${escapeHTML(product.name)}"
        >
          <div class="product-card-main">
            <img
              src="${escapeAttribute(product.image)}"
              alt="${escapeAttribute(product.name)}"
            />

            <div class="product-info">
              <h3>${escapeHTML(product.name)}</h3>
              <p>${escapeHTML(product.brand)}</p>

              <span class="selection-label">
                ${
                  isSelected
                    ? '<i class="fa-solid fa-check" aria-hidden="true"></i> Selected'
                    : "Click card to select"
                }
              </span>

              <button
                type="button"
                class="description-toggle"
                data-description-id="${product.id}"
                aria-expanded="false"
                aria-controls="description-${product.id}"
              >
                <span>View description</span>
                <i
                  class="fa-solid fa-chevron-down"
                  aria-hidden="true"
                ></i>
              </button>
            </div>
          </div>

          <div
            id="description-${product.id}"
            class="product-description"
            hidden
          >
            <p>${escapeHTML(product.description)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

/* ---------- Product selection ---------- */

function toggleProductSelection(productId) {
  const product = allProducts.find(
    (currentProduct) => currentProduct.id === productId,
  );

  if (!product) return;

  const isSelected = selectedProducts.some(
    (selectedProduct) => selectedProduct.id === productId,
  );

  if (isSelected) {
    selectedProducts = selectedProducts.filter(
      (selectedProduct) => selectedProduct.id !== productId,
    );
  } else {
    selectedProducts.push(product);
  }

  saveSelectedProducts();
  renderSelectedProducts();
  refreshCurrentCategory();
}

function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="empty-selection">
        No products selected yet.
      </p>
    `;

    generateRoutineButton.disabled = true;
    clearSelectionsButton.disabled = true;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-item">
          <span>
            <strong>${escapeHTML(product.name)}</strong>
            <small>${escapeHTML(product.brand)}</small>
          </span>

          <button
            type="button"
            class="remove-product"
            data-remove-id="${product.id}"
            aria-label="Remove ${escapeAttribute(product.name)}"
          >
            <i
              class="fa-solid fa-xmark"
              aria-hidden="true"
            ></i>
          </button>
        </div>
      `,
    )
    .join("");

  generateRoutineButton.disabled = false;
  clearSelectionsButton.disabled = false;
}

function refreshCurrentCategory() {
  const selectedCategory = categoryFilter.value;

  if (!selectedCategory) return;

  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
}

/* ---------- Product descriptions ---------- */

function toggleProductDescription(productId, button) {
  const description = document.getElementById(`description-${productId}`);

  if (!description) return;

  const isExpanded = button.getAttribute("aria-expanded") === "true";

  button.setAttribute("aria-expanded", String(!isExpanded));
  description.hidden = isExpanded;

  const label = button.querySelector("span");
  const icon = button.querySelector("i");

  if (label) {
    label.textContent = isExpanded ? "View description" : "Hide description";
  }

  if (icon) {
    icon.classList.toggle("fa-chevron-down", isExpanded);
    icon.classList.toggle("fa-chevron-up", !isExpanded);
  }
}

/* ---------- localStorage ---------- */

function saveSelectedProducts() {
  const selectedIds = selectedProducts.map((product) => product.id);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
}

function restoreSelectedProducts() {
  try {
    const savedValue = localStorage.getItem(STORAGE_KEY);

    if (!savedValue) return;

    const savedIds = JSON.parse(savedValue);

    if (!Array.isArray(savedIds)) return;

    selectedProducts = allProducts.filter((product) =>
      savedIds.includes(product.id),
    );
  } catch (error) {
    console.error("Could not restore selections:", error);
    localStorage.removeItem(STORAGE_KEY);
  }
}

/* ---------- Cloudflare/OpenAI request ---------- */

async function requestAssistant(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed with status ${response.status}.`,
    );
  }

  const answer = data?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("The assistant returned an empty response.");
  }

  return answer;
}

/* ---------- Routine generation ---------- */

async function generateRoutine() {
  if (selectedProducts.length === 0) {
    appendMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
      true,
    );
    return;
  }

  setPageLoading(true);

  chatWindow.innerHTML = "";

  const selectedProductData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const routineRequest = `Create a personalized beauty routine using the selected product data below.

Requirements:
- Base the routine on these selected products.
- Organize the products in a logical order.
- Separate morning, evening, weekly, makeup, haircare, fragrance, or other sections when appropriate.
- Explain how and when to use each selected product.
- Clearly identify products that serve similar purposes or should not necessarily be used together.
- If the selected products do not make a complete routine, explain which routine steps are missing without inventing additional selected products.
- Mention relevant safety considerations from the supplied descriptions.
- End by inviting the user to ask a follow-up question.

Selected product JSON:
${JSON.stringify(selectedProductData, null, 2)}`;

  conversationHistory = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: routineRequest,
    },
  ];

  appendMessage(
    "user",
    `Generate a routine with ${selectedProducts.length} selected product${
      selectedProducts.length === 1 ? "" : "s"
    }.`,
  );

  const typingMessage = appendMessage(
    "assistant",
    "Building your personalized routine…",
  );
  typingMessage.classList.add("typing");

  try {
    const answer = await requestAssistant(conversationHistory);

    typingMessage.textContent = answer;
    typingMessage.classList.remove("typing");

    conversationHistory.push({
      role: "assistant",
      content: answer,
    });

    routineGenerated = true;
    setChatEnabled(true);
    userInput.focus();
  } catch (error) {
    typingMessage.textContent = `Sorry, I couldn’t generate the routine. ${error.message}`;
    typingMessage.classList.remove("typing");
    typingMessage.classList.add("error");

    routineGenerated = false;
    setChatEnabled(false);
  } finally {
    setPageLoading(false);
  }
}

/* ---------- Follow-up chat ---------- */

async function submitFollowUp(event) {
  event.preventDefault();

  const question = userInput.value.trim();

  if (!question) return;

  if (!routineGenerated) {
    appendMessage(
      "assistant",
      "Please generate a routine first so I have the selected products and routine context.",
      true,
    );
    return;
  }

  appendMessage("user", question);

  conversationHistory.push({
    role: "user",
    content: question,
  });

  userInput.value = "";
  setChatLoading(true);

  const typingMessage = appendMessage("assistant", "Thinking…");
  typingMessage.classList.add("typing");

  try {
    const answer = await requestAssistant(conversationHistory);

    typingMessage.textContent = answer;
    typingMessage.classList.remove("typing");

    conversationHistory.push({
      role: "assistant",
      content: answer,
    });

    trimConversationHistory();
  } catch (error) {
    typingMessage.textContent = `Sorry, I couldn’t answer that. ${error.message}`;
    typingMessage.classList.remove("typing");
    typingMessage.classList.add("error");

    if (conversationHistory.at(-1)?.role === "user") {
      conversationHistory.pop();
    }
  } finally {
    setChatLoading(false);
    userInput.focus();
  }
}

/* ---------- Chat interface ---------- */

function appendMessage(role, text, isError = false) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  if (isError) {
    bubble.classList.add("error");
  }

  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return bubble;
}

function setChatEnabled(enabled) {
  userInput.disabled = !enabled;
  sendButton.disabled = !enabled;
}

function setChatLoading(loading) {
  userInput.disabled = loading;
  sendButton.disabled = loading;
  sendButton.setAttribute("aria-busy", String(loading));
}

function setPageLoading(loading) {
  generateRoutineButton.disabled = loading || selectedProducts.length === 0;

  clearSelectionsButton.disabled = loading || selectedProducts.length === 0;

  categoryFilter.disabled = loading;

  if (loading) {
    generateRoutineButton.setAttribute("aria-busy", "true");
    generateRoutineButton.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
      Generating Routine…
    `;
  } else {
    generateRoutineButton.setAttribute("aria-busy", "false");
    generateRoutineButton.innerHTML = `
      <i
        class="fa-solid fa-wand-magic-sparkles"
        aria-hidden="true"
      ></i>
      Generate Routine
    `;
  }
}

function trimConversationHistory() {
  const systemMessage = conversationHistory[0];
  const recentMessages = conversationHistory.slice(-12);

  conversationHistory = [
    systemMessage,
    ...recentMessages.filter((message) => message !== systemMessage),
  ];
}

/* ---------- Event listeners ---------- */

categoryFilter.addEventListener("change", (event) => {
  const selectedCategory = event.target.value;

  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

productsContainer.addEventListener("click", (event) => {
  const descriptionButton = event.target.closest(".description-toggle");

  if (descriptionButton) {
    const productId = Number(descriptionButton.dataset.descriptionId);

    toggleProductDescription(productId, descriptionButton);

    return;
  }

  const productCard = event.target.closest(".product-card");

  if (!productCard) return;

  const productId = Number(productCard.dataset.productId);
  toggleProductSelection(productId);
});

productsContainer.addEventListener("keydown", (event) => {
  if (event.target.closest(".description-toggle")) return;

  const productCard = event.target.closest(".product-card");

  if (!productCard) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();

    const productId = Number(productCard.dataset.productId);
    toggleProductSelection(productId);
  }
});

selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-product");

  if (!removeButton) return;

  const productId = Number(removeButton.dataset.removeId);
  toggleProductSelection(productId);
});

clearSelectionsButton.addEventListener("click", () => {
  selectedProducts = [];

  saveSelectedProducts();
  renderSelectedProducts();
  refreshCurrentCategory();

  routineGenerated = false;
  conversationHistory = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
  ];

  chatWindow.innerHTML = "";

  appendMessage(
    "assistant",
    "Your product selections were cleared. Select new products and generate another routine.",
  );

  setChatEnabled(false);
});

generateRoutineButton.addEventListener("click", generateRoutine);

chatForm.addEventListener("submit", submitFollowUp);

/* ---------- Small helpers ---------- */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

/* ---------- Start application ---------- */

loadProducts();
