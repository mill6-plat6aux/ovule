insert into Organization (OrganizationId, OrganizationName) values (1, 'Demo Company A');

insert into User (UserId, UserName, Password, OrganizationId, UserType) values (1, 'user1@demo.a', sha2('XUmTa6up', 256), 1, 'General');

insert into UserPrivilege (UserId, Data, Permission) values 
	(1, 'Organization', 'Read'),
	(1, 'Users', 'Read'),
	(1, 'Products', 'Read'),
	(1, 'EmissionFactor', 'Read'),
	(1, 'ProductActivity', 'Read'),
	(1, 'ProductFootprint', 'Read'),
	(1, 'DataSource', 'Read'),
	(1, 'Task', 'Read'),
	(1, 'Organization', 'Write'),
	(1, 'Users', 'Write'),
	(1, 'Products', 'Write'),
	(1, 'EmissionFactor', 'Write'),
	(1, 'ProductActivity', 'Write'),
	(1, 'ProductFootprint', 'Write'),
	(1, 'DataSource', 'Write'),
	(1, 'Task', 'Write');