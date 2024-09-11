-- Grant root user access from any host within the Docker network
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'DBPASSWORDHERE' WITH GRANT OPTION;
FLUSH PRIVILEGES;
