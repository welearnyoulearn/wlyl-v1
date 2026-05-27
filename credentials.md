# WLYL Multi-Tenant Portal Credentials

This file contains the credentials for accessing the admin portals (Super Admin and School Admins) in the local development environment.

## 👤 Super Admin Portal
* **URL**: [http://localhost:3000](http://localhost:3000)
* **Username**: `admin`
* **Password**: `admin`
* **Session Token**: `super_admin_token`

---

## 🏫 School Admin Portals
You can log in to these school admin accounts at [http://localhost:3000](http://localhost:3000).

| School ID | School Name | Username | Password | Licence Key (Activation) | API Key (Hardware Taps) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCH001** | ABC School Hyderabad | `school1` | `school1` | `WLYL-A3F2-K9P1-M7X4-B2Q8` | `wlyl_sk_A1B2C3D4E5F6` | Active |
| **SCH002** | Oakridge International | `school2` | `school2` | `WLYL-B3F2-L9P1-N7X4-C2Q8` | `wlyl_sk_B2C3D4E5F6G7` | Active |
| **SCH003** | Vkreddy | `vamsi` | `vamsi` | `WLYL-0DFC-3630-EBEB-3F07` | `wlyl_sk_CC6A77271595` | Active |

---

> [!NOTE]
> * **School Activation**: When registering new schools under the Super Admin panel, they start in a **Pending Activation** status. You must log in as the newly created school admin and submit their **Licence Key** under the **Licence & Settings** tab to activate them.
> * **Hardware ID Lock**: The default hardware ID is set to `A1B2C3D4` for simulator terminal actions.
