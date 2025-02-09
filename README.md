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
