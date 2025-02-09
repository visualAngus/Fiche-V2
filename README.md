# Fiche-V2
This program is the second version of a SaaS service called _Fiche_. This README will present the features and characteristics of the project.

## Authentication
For this project, I wanted to prioritize security above all. Therefore, there is an advanced login system that forms the basis of the service's functionality.

- ### Account creation:
  When the user creates their account, their username and the `hash` of their password are stored in the database.
  
- ### Login:
  When the user logs in, first the `hash` of the input password is compared with the `hash` stored in the database. If they match, a secondary key is generated. Using the raw password, a key derived from the server's key is generated. This key is unique and can only be generated with the server key + the user's password.
  <br>
  <br>
  <br>
  This secondary key is stored in the cookies, along with a token containing the user's information:
  <br>
  <br>
  ```
  const payload = {
        username: name,
        userID: id,
        role: "user"
  };
  const options = { expiresIn: '1h' };;
  ```

- ### Encryption:
  The secondary key is used to encrypt all sensitive text data related to the user.

## Home page

![image](https://github.com/user-attachments/assets/3b2ec84f-00f4-41a3-890b-b9fd7b529c05)

- On this page, you will find all your notes, as well as all your _subject_ groups. The notes are interactive, and you can already `scroll` through the content of the note.

You can open the editor:
![image](https://github.com/user-attachments/assets/afd1b1a5-7165-41cb-99e7-ea5aa74ca83d)
