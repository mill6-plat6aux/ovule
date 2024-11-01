insert into Organization (OrganizationId, OrganizationName) values (1, 'Demo Company A');

insert into OrganizationIdentifier (OrganizationId, Code, Type) values (1, '11430330-7027-4ee7-98db-48d162c39cdf', 'UUID');

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

insert into Organization (OrganizationId, OrganizationName, OrganizationType, ParentOrganizationId) values (2, 'Demo Company B', 'BusinessPartner', 1);

insert into OrganizationIdentifier (OrganizationId, Code, Type) values (2, '70e88c99-1cca-4c88-9216-7686aff2270a', 'UUID');

insert into User (UserId, UserName, Password, OrganizationId, UserType) values (2, 'user2@demo.a', sha2('pJ6kZu2H', 256), 2, 'Pathfinder');

insert into UserPrivilege (UserId, Data, Permission) values 
	(2, 'ProductFootprint', 'Read'),
	(2, 'Products', 'Write'),
	(2, 'EmissionFactor', 'Write'),
	(2, 'ProductFootprint', 'Write'),
	(2, 'Task', 'Write');