# Klinn for clinics

Klinn is a minimal application for keeping electronical medical records. It focuses mainly on convenience and simplicity.
It was designed for mobile clinics in rural areas, where there may be no internet connection.

## Features
* Keep the name, lastname, gender and birthdate of each patient.
* Separate visits help you fill information without the need of creating a new patient for the same person.
* Reports! You are able to choose dates in between which the application will analyze the visits and produce a `.csv` report.
* Storage! Import your inventory into the application. The application will then start updating the inventory based on prescriptions. It will warn the doctor when they prescribe some amount that is more than what you have in the inventory.
* Synchronization between clients.
* Filter patients by full name.
* You can make a backup by simply copy-pasting the `data.db` file.
* Responsive design. Use the application on mobile (It's a bit of a WIP but the design is currently bearable)
* Open source!

## Usage
Klinn utilizes a server-client model. Both the server and the clients have to be on the same network in order for them to communicate and sync data.

You can add accounts into the `accounts` table in the database if you want to customize the accounts. Otherwise, default accounts will be used.

## Reports
The reports include:
* Number of visits
* Gender distribution
* Age distribution
* Diagnostics
* Complaints
* Medication

both in numbers and in percantages. If a patient has more than one diagnoses, you can seperate them by a comma, so that the diagnoses appear seperately on the reports. You can do the same for complaints as well.
