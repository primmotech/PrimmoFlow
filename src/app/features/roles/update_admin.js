const sdk = require('node-appwrite');

// --- CONFIGURATION ---
const client = new sdk.Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('694eb89e001a66c2311f')
    .setKey('standard_0dd840cdb5120992667c7ede56ab0545f6bdb7823bfad34508aaa3d82d955d97492a56c80ff1dd84ec582698e247abed0b72aeac23b8aaeb0e5849f115b9960b2ce741a1092d9aa7e386541fd6d6186fc27c0744db13020661244d6eaf556b110d9ea47058c9be34780758a67fbc39392925f49ae1ffde5938b0f35a06a66c28'); 

const databases = new sdk.Databases(client);
const DB_ID = '694eba69001c97d55121';
const COL_ROLES = 'roles';
const ADMIN_DOC_ID = 'Administrateur'; // <--- VERIFIE l'ID de ton document Admin ici !

// --- TOUTES LES PERMS A ACTIVER ---
const permissionsToEnable = {
    // Dashboard
    dash_view_all: true,
    dash_view_contacts: true,
    dash_view_prices: true,
    dash_act_edit: true,
    dash_act_tasks: true,
    dash_act_plan: true,
    dash_act_delete: true,
    dash_nav_add: true,
    dash_nav_details: true,
    dash_nav_invoice: true,
    dash_nav_billed: true,
    dash_nav_orders: true,
    dash_nav_archives: true,
    dash_nav_params: true,
    // Paramètres
    param_view_costs: true,
    param_edit_name: true,
    param_edit_nickname: true,
    param_edit_phone: true,
    param_edit_gps: true,
    param_edit_costs: true,
    param_edit_theme: true,
    // Panel Admin
    param_panel_equipes: true,
    param_panel_roles: true,
    param_panel_whitelist: true
};

async function updateAdminRole() {
    try {
        await databases.updateDocument(
            DB_ID, 
            COL_ROLES, 
            ADMIN_DOC_ID, 
            permissionsToEnable
        );
        console.log(`✅ Le document Admin "${ADMIN_DOC_ID}" a été mis à jour avec toutes les permissions !`);
    } catch (e) {
        console.error(`❌ Erreur lors de la mise à jour :`, e.message);
        console.log(`💡 Vérifie que l'ID "${ADMIN_DOC_ID}" est bien le bon ID de ton document dans la collection roles.`);
    }
}

updateAdminRole();