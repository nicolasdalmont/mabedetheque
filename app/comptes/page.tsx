import { redirect } from "next/navigation";

// La gestion des comptes est affichée directement sur « Mon compte » pour les
// admins ; cette route ne subsiste que pour d'éventuels liens existants.
export default function AccountsPage() {
  redirect("/compte");
}
