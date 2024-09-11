# Lyrical Project

  

This is the backend for the Lyrical Project, which is powered by Node.js, MySQL, and Flask. The project also supports token-based authentication with JWT and provides CORS support.


## Environment Setup

To get started, you will need to create a `.env` file with the following configurations:

  

### 1. JWT Secret Key

Generate a secret key using the following Python command:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
Then, set the `SECRET_KEY` in the `.env` file:

`SECRET_KEY=your_generated_secret_key` 

### 2. Flask API URL

Make sure to set up the Flask API URL:

`FLASK_API_URL=http://localhost:5000` 

### 3. VITE API Base URL

Set the API Base URL for VITE:

`VITE_API_BASE_URL=http://localhost:5001` 

### 4. CORS Allowed Origins

Define the allowed origins for Node.js and Flask to handle CORS:

`NODE_ALLOWED_ORIGIN=http://localhost
FLASK_ALLOWED_ORIGIN=http://localhost:3000` 

### 5. Database Configuration

Configure your MySQL database connection details:

`DB_HOST=db
DB_NAME=LyricalDB
DB_USER=root
DB_ROOT_PASSWORD=YourPasswordHere` 

### Example ENV file:

> SECRET_KEY=
> 
> FLASK_API_URL=http://localhost:5000
> 
> #VITE_API_BASE_URL
> 
> VITE_API_BASE_URL=http://localhost:5001
> 
> NODE_ALLOWED_ORIGIN=http://localhost
> 
> FLASK_ALLOWED_ORIGIN=http://localhost:3000
> 
> DB_HOST=db
> 
> DB_NAME=LyricalDB
> 
> DB_USER=root
> 
> DB_ROOT_PASSWORD=DBPASSWORDHERE

## Database Setup

To correctly configure the MySQL database, open the file `Lyrical/Lyrical-Backend/init-mysql.sql` and update the password for the root user with your `DB_ROOT_PASSWORD`.

Replace `YOUR_DB_PASSWORD_HERE` with the actual password in the following SQL command:

`-- Grant root user access from any host within the Docker network
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'YOUR_DB_PASSWORD_HERE' WITH GRANT OPTION;
FLUSH PRIVILEGES;` 

## Running the Project

Once your environment variables and database configuration are set up:

1.  Go to the base directory of the project:
       
    `cd Lyrical` 
    
2.  Run the project using Docker Compose:
    
    `docker-compose up` 
    

## Access the Application

After the containers are up and running, visit:

`https://localhost` 

The application will be up and running!