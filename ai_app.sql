-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: ai_app
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `isFavorite` tinyint(1) NOT NULL DEFAULT '0',
  `isArchived` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_conversations_user_updated` (`userId`,`updatedAt`),
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
INSERT INTO `conversations` VALUES ('0e196c72-4a99-4c28-8991-b6a1c7ce7ec1',NULL,'12321',0,0,'2026-04-29 11:34:38','2026-04-29 11:34:38'),('20fcdd0c-f1dc-4af1-abf7-3fc46c91efce',NULL,'测试保存消息',0,0,'2026-04-28 06:02:17','2026-04-28 06:02:17'),('39d47458-f50e-47bc-8487-4517cc6b204b',NULL,'你是什么模型？',0,0,'2026-04-29 11:01:08','2026-04-29 11:01:08'),('714f89b7-5476-447a-b3c5-4e4ca84a755c',NULL,'12321312',0,0,'2026-04-29 11:12:44','2026-04-29 11:12:44'),('928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9',NULL,'hello',0,0,'2026-04-28 06:03:18','2026-04-28 06:03:18'),('af305953-a99c-4feb-a390-0b85d59f5c95',NULL,'21321',0,0,'2026-04-29 11:20:05','2026-04-29 11:20:05');
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `media_tasks`
--

DROP TABLE IF EXISTS `media_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_tasks` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `type` enum('image','video') NOT NULL,
  `status` enum('pending','processing','retrying','succeeded','failed') NOT NULL DEFAULT 'pending',
  `provider` varchar(32) DEFAULT NULL,
  `model` varchar(128) DEFAULT NULL,
  `prompt` text NOT NULL,
  `size` varchar(32) DEFAULT NULL,
  `n` int NOT NULL DEFAULT '1',
  `attempts` int NOT NULL DEFAULT '0',
  `maxAttempts` int NOT NULL DEFAULT '3',
  `estimatedCost` int NOT NULL DEFAULT '0',
  `actualCost` int DEFAULT NULL,
  `result` text,
  `errorCode` varchar(64) DEFAULT NULL,
  `errorMessage` text,
  `nextRetryAt` datetime DEFAULT NULL,
  `startedAt` datetime DEFAULT NULL,
  `completedAt` datetime DEFAULT NULL,
  `meta` text,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_media_tasks_status_next_retry` (`status`,`nextRetryAt`),
  KEY `idx_media_tasks_user_created_at` (`userId`,`createdAt`),
  KEY `idx_media_tasks_type_status_created` (`type`,`status`,`createdAt`),
  CONSTRAINT `media_tasks_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `media_tasks`
--

LOCK TABLES `media_tasks` WRITE;
/*!40000 ALTER TABLE `media_tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `media_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `conversationId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` text NOT NULL,
  `model` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversation_created_role` (`conversationId`,`createdAt`,`role`),
  KEY `idx_messages_role_created_model` (`role`,`createdAt`,`model`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`conversationId`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES ('02e2bceb-7150-4078-9010-97a2ca2b5c42','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：你好','glm-4','2026-04-28 06:23:14','2026-04-28 06:23:14'),('0368c57e-0d6c-48fe-913a-0b069ed2c836','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','当前路由模型：通义千问 Turbo（应用ID: qwen-turbo）。上游模型参数：qwen-turbo。','qwen-turbo','2026-04-28 06:03:30','2026-04-28 06:03:30'),('06bf9009-5cd2-492f-98cb-03f00970b05e','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：node','glm-4','2026-04-28 06:13:03','2026-04-28 06:13:03'),('0ff01bc1-6f01-490f-9f79-f6e4fe5d306b','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我先说核心结果，再给你简短说明。\n\n你问的是：hello','glm-4','2026-04-28 06:03:19','2026-04-28 06:03:19'),('14d8e95e-3706-456e-b8fc-428fd2266cb2','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','hello','user','2026-04-28 06:03:18','2026-04-28 06:03:18'),('1d041fae-3538-467d-8823-5880705c4833','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','我在本地额外','user','2026-04-28 06:14:06','2026-04-28 06:14:06'),('2378f5f4-8494-48f8-b94e-db0a3f1d624d','714f89b7-5476-447a-b3c5-4e4ca84a755c','user','12321312','user','2026-04-29 11:12:44','2026-04-29 11:12:44'),('24cb448c-b4f1-4cfe-af23-4981c5d68c68','af305953-a99c-4feb-a390-0b85d59f5c95','assistant','\n您好！我看到您提供了\"21321\"这个数字，但似乎没有附带具体的问题或请求。请问您需要我帮助您做什么？我可以为您提供信息查询、解答问题或协助您完成各种任务。请告诉我您的具体需求，我会尽力为您提供帮助。','glm-4','2026-04-29 11:20:14','2026-04-29 11:20:14'),('2746b19c-3bf8-4b42-bf8e-64fa7d62d5d0','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','你是什么模型？','user','2026-04-28 06:03:30','2026-04-28 06:03:30'),('3d1703d9-550d-4f12-b70c-7ff29614bff5','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','你好！有什么我可以帮助你的吗？','deepseek-v3','2026-04-28 06:23:38','2026-04-28 06:23:38'),('46ef0530-6bfc-41c5-b1c2-589c2383c223','714f89b7-5476-447a-b3c5-4e4ca84a755c','assistant','\n\nIt seems you\'ve shared a sequence of numbers (12321312). Could you clarify what you\'d like to do with this? For example:  \n- Decode or analyze the pattern?  \n- Extend the sequence?  \n- Check if it matches a specific format (e.g., code, ID)?  \n\nLet me know how I can assist! 😊','qwen-turbo','2026-04-29 11:12:49','2026-04-29 11:12:49'),('48905e66-02c9-43d2-a01a-21469e1a6439','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：我在本地额外','deepseek-v3','2026-04-28 06:14:07','2026-04-28 06:14:07'),('490ca31c-dcec-44bb-8302-69ac4170a6f3','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：你好','qwen-turbo','2026-04-28 06:12:50','2026-04-28 06:12:50'),('4e0f802c-12dc-4fa2-b043-9ea094a6c6e0','714f89b7-5476-447a-b3c5-4e4ca84a755c','assistant','您输入的内容是“12321312”，看起来像是数字序列、编号或代码。  \n有什么需要帮助的吗？比如计算、解析含义或者格式转换等？','deepseek-v3','2026-04-29 11:12:52','2026-04-29 11:12:52'),('52d4350c-c82b-4f95-969b-8f85329da366','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','这个问题我先给你结论，再补充关键信息。\n\n你问的是：node','qwen-turbo','2026-04-28 06:13:03','2026-04-28 06:13:03'),('54c05c89-1a91-490d-bafc-166de7b87233','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：我在本地额外','glm-4','2026-04-28 06:14:07','2026-04-28 06:14:07'),('56b2c90d-e622-4d19-8906-6103494b7527','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','\n我先说核心结果，再给你简短说明。\n\n你问的是：你是','glm-4','2026-04-28 06:28:27','2026-04-28 06:28:27'),('580e401e-2a65-4639-93e4-2855a81c2a37','0e196c72-4a99-4c28-8991-b6a1c7ce7ec1','assistant','\nI see you\'ve entered the number 12321. That\'s an interesting palindrome number! Is there something specific you\'d like me to help you with regarding this number, such as checking its properties, performing calculations, or something else? I\'m here to assist you with any questions or tasks you have.','glm-4','2026-04-29 11:34:42','2026-04-29 11:34:42'),('652a3716-20f3-4b27-8234-48109fd08963','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','这个问题我先给你结论，再补充关键信息。\n\n你问的是：hello','deepseek-v3','2026-04-28 06:03:19','2026-04-28 06:03:19'),('72baf13a-0d2f-4e50-b986-fdbfbe35f66c','0e196c72-4a99-4c28-8991-b6a1c7ce7ec1','assistant','12321 这个数字从左到右和从右到左读起来是一样的，它是一个**回文数**（palindrome number）。\n\n在数学中，回文数在十进制下正着读和反着读都相同。  \n12321 还是个完全平方数，因为  \n\\[\n111^2 = 12321\n\\]\n\n需要我为你解释其他有趣的性质吗？','deepseek-v3','2026-04-29 11:34:43','2026-04-29 11:34:43'),('76003b4d-ce28-4b9d-ab9b-4c7802ce34bb','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','这个问题我先给你结论，再补充关键信息。\n\n你问的是：你好','glm-4','2026-04-28 06:12:50','2026-04-28 06:12:50'),('7857408b-5f13-4faf-8310-847a5e64acd7','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：今天天气怎么样？','qwen-turbo','2026-04-28 06:03:40','2026-04-28 06:03:40'),('78996bce-2548-4ac4-bd1f-88732330f5ac','39d47458-f50e-47bc-8487-4517cc6b204b','assistant','当前路由模型：DeepSeek-V3（应用ID: deepseek-v3）。上游模型参数：Pro/deepseek-ai/DeepSeek-V3.2。','deepseek-v3','2026-04-29 11:01:09','2026-04-29 11:01:09'),('7a762495-4e1a-4a77-8904-853129981a32','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','你好！我是DeepSeek最新版本模型，由深度求索公司创造的AI助手。很高兴为你提供帮助！\n\n如果你有编程、学习、工作或生活上的任何问题，我都很乐意协助你解决。有什么我可以帮你的吗？😊','deepseek-v3','2026-04-28 06:28:09','2026-04-28 06:28:09'),('87fa16cc-a16a-4620-89ac-45ff448cde27','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：node','deepseek-v3','2026-04-28 06:13:03','2026-04-28 06:13:03'),('8fc33a3b-8728-4043-a07a-e3860e9e7ecc','0e196c72-4a99-4c28-8991-b6a1c7ce7ec1','assistant','\n\n您好！看到数字\"12321\"，我想到这可能是：  \n1️⃣ 一个电话号码（如中国的网络不良信息举报热线）  \n2️⃣ 某种代码或验证码  \n3️⃣ 误触输入  \n\n请问您需要了解什么具体内容？我会尽力提供帮助哦！ 😊  \n（如果涉及安全/技术类需求，建议您直接联系官方渠道更稳妥～）','qwen-turbo','2026-04-29 11:34:46','2026-04-29 11:34:46'),('95202165-f908-4c7a-86b4-83efbd4e6ddd','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我先说核心结果，再给你简短说明。\n\n你问的是：今天天气怎么样？','glm-4','2026-04-28 06:03:40','2026-04-28 06:03:40'),('9ee46f69-c8c0-48ba-9f07-203fc820d4e2','20fcdd0c-f1dc-4af1-abf7-3fc46c91efce','user','测试保存消息','manus','2026-04-28 06:02:17','2026-04-28 06:02:17'),('a3d8e133-194b-4f67-8ca2-8e2813165f00','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','当前路由模型：智谱 GLM（应用ID: glm-4）。上游模型参数：glm-4。','glm-4','2026-04-28 06:03:30','2026-04-28 06:03:30'),('aa370ab5-80fe-4e38-9b29-15d5a4a28e06','af305953-a99c-4feb-a390-0b85d59f5c95','assistant','\n\nHello! It looks like you\'ve sent a sequence of numbers. Could you please clarify if there\'s something specific you need help with? Whether it\'s converting guidelines, solving a problem, or something else—I\'m here to assist! 😊','qwen-turbo','2026-04-29 11:20:11','2026-04-29 11:20:11'),('b02c8e13-90e5-4673-a2fb-b5bb18d093d4','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','这个问题我先给你结论，再补充关键信息。\n\n你问的是：hello','qwen-turbo','2026-04-28 06:03:19','2026-04-28 06:03:19'),('b1462481-0026-4767-bf5b-7f797cb1af82','39d47458-f50e-47bc-8487-4517cc6b204b','assistant','当前路由模型：通义千问 Turbo（应用ID: qwen-turbo）。上游模型参数：Qwen/Qwen3.5-9B。','qwen-turbo','2026-04-29 11:01:09','2026-04-29 11:01:09'),('b2bdbaf4-d6b7-4866-ad30-382f8a3541ab','39d47458-f50e-47bc-8487-4517cc6b204b','user','你是什么模型？','user','2026-04-29 11:01:08','2026-04-29 11:01:08'),('b3a79ee8-15dc-47ed-9282-2b07f9719cd5','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','你好','user','2026-04-28 06:23:13','2026-04-28 06:23:13'),('baec5a4b-ec20-4517-9cf3-cb709ff97ad3','714f89b7-5476-447a-b3c5-4e4ca84a755c','assistant','\nI understand you\'ve entered the number \"12321312\". This appears to be a sequence of digits, but I\'m not sure what you\'d like me to help you with regarding this number.\n\nCould you please let me know what you\'d like me to do with this number? For example:\n- Are you looking for information about this number?\n- Do you need help with a calculation involving this number?\n- Or is there something else you\'d like to know about it?\n\nI\'m here to assist you, so please clarify what you need!','glm-4','2026-04-29 11:12:57','2026-04-29 11:12:57'),('cf5a9c8b-deaa-4f2d-9bb0-a2256c2012d6','af305953-a99c-4feb-a390-0b85d59f5c95','assistant','你好！我注意到你输入的是数字“21321”。\n\n请问有什么我可以帮助你的吗？是想知道这个数字有什么特别的含义，还是希望我帮你分析和解释呢？我很乐意为你提供帮助！','deepseek-v3','2026-04-29 11:20:09','2026-04-29 11:20:09'),('d56698d2-34e4-44b8-83ba-e1a4c53c3094','0e196c72-4a99-4c28-8991-b6a1c7ce7ec1','user','12321','user','2026-04-29 11:34:38','2026-04-29 11:34:38'),('d6147a1e-885f-4cbd-9d53-9de7c8436de7','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','你是 ','user','2026-04-28 06:27:57','2026-04-28 06:27:57'),('db42d5dd-fe17-4883-9083-137fa2fd5728','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','今天天气怎么样？','user','2026-04-28 06:03:39','2026-04-28 06:03:39'),('db5d3f59-eb46-48a5-b535-4d867da6a86e','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我先说核心结果，再给你简短说明。\n\n你问的是：你好','qwen-turbo','2026-04-28 06:23:14','2026-04-28 06:23:14'),('dc4be9d7-848d-43c5-b899-b9550694d69f','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我理解你的问题了，下面给你一个简明回答。\n\n你问的是：你好','deepseek-v3','2026-04-28 06:12:50','2026-04-28 06:12:50'),('dcfddc26-f708-41e5-9e8c-675d4c04a4a5','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','当前路由模型：DeepSeek-V3（应用ID: deepseek-v3）。上游模型参数：deepseek-chat。','deepseek-v3','2026-04-28 06:03:30','2026-04-28 06:03:30'),('df3f8c7d-d7fe-444b-909c-af2efe3dd1dd','af305953-a99c-4feb-a390-0b85d59f5c95','user','21321','user','2026-04-29 11:20:05','2026-04-29 11:20:05'),('e2126432-63f2-4582-b81b-bafdc15f2b79','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','node','user','2026-04-28 06:13:02','2026-04-28 06:13:02'),('e55d72ae-0101-434d-84c6-a5ab5fe1cad6','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','这个问题我先给你结论，再补充关键信息。\n\n你问的是：我在本地额外','qwen-turbo','2026-04-28 06:14:07','2026-04-28 06:14:07'),('ed0fc000-b2c6-4582-9932-3d117d584dfd','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','\n\n我是通义千问 Turbo。','qwen-turbo','2026-04-28 06:29:05','2026-04-28 06:29:05'),('ed85a5df-09d9-4060-a550-7b6a5ce0fbbf','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','assistant','我先说核心结果，再给你简短说明。\n\n你问的是：今天天气怎么样？','deepseek-v3','2026-04-28 06:03:40','2026-04-28 06:03:40'),('f77fc752-4d76-401b-a023-81381aee1549','928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9','user','你好','user','2026-04-28 06:12:49','2026-04-28 06:12:49'),('fff210b2-9bb1-4571-aed3-90f7e8d37c0d','39d47458-f50e-47bc-8487-4517cc6b204b','assistant','当前路由模型：智谱 GLM（应用ID: glm-4）。上游模型参数：zai-org/GLM-4.6V。','glm-4','2026-04-29 11:01:09','2026-04-29 11:01:09');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_audit_logs`
--

DROP TABLE IF EXISTS `order_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_audit_logs` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `orderId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `actorUserId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `action` varchar(64) NOT NULL,
  `beforeSnapshot` text,
  `afterSnapshot` text,
  `note` text,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_audit_logs_order_id` (`orderId`),
  KEY `idx_order_audit_logs_actor_user_id` (`actorUserId`),
  KEY `idx_order_audit_logs_created_at` (`createdAt`),
  CONSTRAINT `order_audit_logs_ibfk_1` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `order_audit_logs_ibfk_2` FOREIGN KEY (`actorUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_audit_logs`
--

LOCK TABLES `order_audit_logs` WRITE;
/*!40000 ALTER TABLE `order_audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `plan` enum('monthly','quarterly','yearly','token_pack') NOT NULL,
  `planKey` varchar(255) DEFAULT NULL,
  `planSnapshot` text,
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `refundedAmount` decimal(10,2) DEFAULT NULL,
  `refundedAt` datetime DEFAULT NULL,
  `paymentMethod` varchar(255) NOT NULL DEFAULT 'mock_pay',
  `transactionId` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orders_status_created_user` (`status`,`createdAt`,`userId`),
  KEY `idx_orders_user_status_created` (`userId`,`status`,`createdAt`),
  KEY `idx_orders_plan_status_created` (`planKey`,`status`,`createdAt`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` varchar(128) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `executedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` VALUES ('202603030001_add_order_plan_fields','Add planKey and planSnapshot columns to orders table','2026-04-28 06:01:26'),('202603030002_add_visit_logs_table','Add visit_logs table for tracking member and guest traffic','2026-04-28 06:01:26'),('202603030003_add_order_refund_and_audit','Add refunded status/fields to orders and create order_audit_logs table','2026-04-28 06:01:26'),('202603030004_add_rbac_and_media_tasks','Expand user roles for RBAC and create media_tasks table','2026-04-28 06:01:26'),('202603030005_add_composite_indexes','Add high-frequency composite indexes for orders/token/conversations/messages/visit_logs','2026-04-28 06:01:26'),('202603060001_add_conversation_favorite','Add favorite flag to conversations','2026-04-28 06:01:26'),('202603060002_add_conversation_archive','Add archive flag to conversations','2026-04-28 06:01:26');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_configs`
--

DROP TABLE IF EXISTS `system_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_configs` (
  `key` varchar(255) NOT NULL,
  `value` text,
  `description` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_configs`
--

LOCK TABLES `system_configs` WRITE;
/*!40000 ALTER TABLE `system_configs` DISABLE KEYS */;
INSERT INTO `system_configs` VALUES ('default_quota','5000',NULL,'2026-04-29 06:04:49','2026-04-29 06:04:49'),('enable_registration','true',NULL,'2026-04-29 06:04:49','2026-04-29 06:04:49'),('guest_trial_limit','100',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('membership_monthly_quota_last_cycle','2026-04','Last completed monthly quota cycle','2026-04-28 06:02:13','2026-04-28 06:02:13'),('model_config:deepseek-r1','{\"provider\":\"openai\",\"apiKey\":\"sk-rvwtfyfmsrxwkpkdjtpxjzqpnsdowadradvarykkvqhvjwny\",\"baseURL\":\"https://api.siliconflow.cn/v1\",\"modelId\":\"Pro/deepseek-ai/DeepSeek-R1\"}',NULL,'2026-04-28 06:23:07','2026-04-28 06:23:07'),('model_config:deepseek-v3','{\"provider\":\"openai\",\"apiKey\":\"sk-rvwtfyfmsrxwkpkdjtpxjzqpnsdowadradvarykkvqhvjwny\",\"baseURL\":\"https://api.siliconflow.cn/v1\",\"modelId\":\"Pro/deepseek-ai/DeepSeek-V3.2\"}',NULL,'2026-04-28 06:22:12','2026-04-28 06:22:12'),('model_config:glm-4','{\"provider\":\"openai\",\"apiKey\":\"sk-rvwtfyfmsrxwkpkdjtpxjzqpnsdowadradvarykkvqhvjwny\",\"baseURL\":\"https://api.siliconflow.cn/v1\",\"modelId\":\"zai-org/GLM-4.6V\"}',NULL,'2026-04-28 06:24:50','2026-04-28 06:24:50'),('model_config:moonshot-v1','{\"provider\":\"openai\",\"apiKey\":\"sk-rvwtfyfmsrxwkpkdjtpxjzqpnsdowadradvarykkvqhvjwny\",\"baseURL\":\"https://api.siliconflow.cn/v1\",\"modelId\":\"Pro/moonshotai/Kimi-K2.5\"}',NULL,'2026-04-28 06:27:24','2026-04-28 06:27:24'),('model_config:qwen-plus','{\"provider\":\"openai\",\"apiKey\":\"sk-rvwtfyfmsrxwkpkdjtpxjzqpnsdowadradvarykkvqhvjwny\",\"baseURL\":\"https://api.siliconflow.cn/v1\",\"modelId\":\"Qwen/Qwen3.6-27B\"}',NULL,'2026-04-28 06:26:54','2026-04-28 06:26:54'),('model_config:qwen-turbo','{\"provider\":\"openai\",\"apiKey\":\"sk-rvwtfyfmsrxwkpkdjtpxjzqpnsdowadradvarykkvqhvjwny\",\"baseURL\":\"https://api.siliconflow.cn/v1\",\"modelId\":\"Qwen/Qwen3.5-9B\"}',NULL,'2026-04-28 06:26:21','2026-04-28 06:26:21'),('multi_model_trial_limit','10',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_BLACKLIST_IPS','',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_BLACKLIST_USERS','',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_FACTOR_FREE','1',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_FACTOR_PREMIUM','2.4',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_FACTOR_PRO','1.6',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_OFFPEAK_FACTOR','1.15',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_PEAK_FACTOR','0.9',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_PEAK_HOURS','09-23',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_REPUTATION_PENALTY','0.7',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_REPUTATION_THRESHOLD','20',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_WHITELIST_IPS','',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('RATE_LIMIT_WHITELIST_USERS','',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('site_name','AI 智能助手',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_APP_ID','wxf07a2aadb806a199',NULL,'2026-04-29 06:04:50','2026-04-29 06:12:57'),('WECHAT_APP_SECRET','06cd85ddf6fe8f06ec6c720cfd41ea05',NULL,'2026-04-29 06:04:50','2026-04-29 06:12:57'),('WECHAT_PAY_API_V3_KEY','YKB123qazwsxedcrfvtgbyhnyhnujmik',NULL,'2026-04-29 06:04:50','2026-04-29 06:12:57'),('WECHAT_PAY_APP_ID','wxf07a2aadb806a199',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_PAY_CERT_PEM','MIIELjCCAxagAwIBAgIUaz55bGtle28yTfJHwNTBmPXeFzgwDQYJKoZIhvcNAQEL\nBQAwXjELMAkGA1UEBhMCQ04xEzARBgNVBAoTClRlbnBheS5jb20xHTAbBgNVBAsT\nFFRlbnBheS5jb20gQ0EgQ2VudGVyMRswGQYDVQQDExJUZW5wYXkuY29tIFJvb3Qg\nQ0EwHhcNMjYwMzA2MTEyNjQ3WhcNMzEwMzA1MTEyNjQ3WjCBhzETMBEGA1UEAwwK\nMTQzMTMwNjEwMjEbMBkGA1UECgwS5b6u5L+h5ZWG5oi357O757ufMTMwMQYDVQQL\nDCrljJfkuqzluILmnInnqbrluK7nvZHnu5znp5HmioDmnInpmZDlhazlj7gxCzAJ\nBgNVBAYTAkNOMREwDwYDVQQHDAhTaGVuWmhlbjCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBAMchCKTaNN6KwKjCtqe8V7+VpuVh8GZtMMpgnpiXMYNLizkD\npwMvZRGYwpAe+lnDikZiLcpmqjZimTyuBhsEQ6Jc33y+7cE5CVOajkTYBv49bwPh\nRz/CAwyBKYpPTv9akqmV0EMVHXIOI7p+XKTsdHBxCgBqMSMP80jOqUfZucRgHj7t\n4qnu0qZWTvsLYPU/pyjBl5/n+SJDdIS7+SF3naCBW1QOIxafxFqR07YWSc+xUwb0\n0dzDvCd3obHx+rrttaaM66MwrlNi0DgYJwsrgB3iWEak/wyajCFXfiRtSPxs7TiZ\nNm4JQrdX0K8VYoci31yAEoLTLz/PqFChOiLBY98CAwEAAaOBuTCBtjAJBgNVHRME\nAjAAMAsGA1UdDwQEAwID+DCBmwYDVR0fBIGTMIGQMIGNoIGKoIGHhoGEaHR0cDov\nL2V2Y2EuaXRydXMuY29tLmNuL3B1YmxpYy9pdHJ1c2NybD9DQT0xQkQ0MjIwRTUw\nREJDMDRCMDZBRDM5NzU0OTg0NkMwMUMzRThFQkQyJnNnPUhBQ0M0NzFCNjU0MjJF\nMTJCMjdBOUQzM0E4N0FEMUNERjU5MjZFMTQwMzcxMA0GCSqGSIb3DQEBCwUAA4IB\nAQAsrIDWipuSP/1j7ZM0jzptVwRcUNEzR49qdjCVrlypA15smaQLgiNiGvxc2Sbe\npWQyOk0qy7kkK+MK/UiKfBC79Ju6hpS2nuC5nRWdW90eQU0ZCvOBcX6HtT38ZDBc\niKkHfMQRbY+uU5HvAs/ICAN+sL0uP/pUbNNqdJxCHANd9iCqlGqd11tloNWZH2um\n5O7SSFeVGEvrQ3wJIy56zSZWTtsj4MXdmYF8zV70dYfyL3hv3ajxhZqer45FAnNu\nzAh42Frkh6Gs+YXldtgN/hLIfYD3WrebbNZJfXqjiDxW6FoduW2O364X/r5wVQ3j\nCq/YkNc0YEf5I7b8vmrizNGR',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_PAY_CERT_SERIAL_NO','',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_PAY_ENABLED','true',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_PAY_MCH_ID','1431306102',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_PAY_MOCK_MODE','false',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_PAY_NOTIFY_URL','https://ai.ukb88.com/api/payment/wechat/notify',NULL,'2026-04-29 06:04:50','2026-04-29 06:12:57'),('WECHAT_PAY_PRIVATE_KEY','MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHIQik2jTeisCo\nwranvFe/lablYfBmbTDKYJ6YlzGDS4s5A6cDL2URmMKQHvpZw4pGYi3KZqo2Ypk8\nrgYbBEOiXN98vu3BOQlTmo5E2Ab+PW8D4Uc/wgMMgSmKT07/WpKpldBDFR1yDiO6\nflyk7HRwcQoAajEjD/NIzqlH2bnEYB4+7eKp7tKmVk77C2D1P6cowZef5/kiQ3SE\nu/khd52ggVtUDiMWn8RakdO2FknPsVMG9NHcw7wnd6Gx8fq67bWmjOujMK5TYtA4\nGCcLK4Ad4lhGpP8MmowhV34kbUj8bO04mTZuCUK3V9CvFWKHIt9cgBKC0y8/z6hQ\noToiwWPfAgMBAAECggEANutice0IpdQI3MKPE+X7IYjJtfv0DJvS2A4bz6PrcPW1\n2SyrtFIvAtJp3svcakNm8JCFZow4J7W746NvZaYgbThGHyaddiwf6WH4GP6ntxkE\ndEJ+nxQIOTuqVE4ZUI4PYxxBiy7YpytFKVtOe+IHHzfd9U1UbgIpLAxrXbir5n/K\nmJ6uVSlTCUhJ49O7wlEIiErC/EIob4Md0U+YOpe59AurOXmTVHK8iM81/uXlv6Gt\noHn5U9clUslflP+i2gXpn9f90F6Hbr40IRGLgIToZUUrkIonCVQdSNu7t8ej3SCe\njKwy20bxuWeZdtI+B3CNR/Y+Vz2/8OS/Ue2/lcEg4QKBgQD9Y1cNqJ4MMUqNhtmk\nNEVMPGB1vlZbDTQOF1YpP8ybD7YIuXuW0OYaWFbsVOWgTouAx5OtGTuvu7GZahMZ\n4rQuDImsu5tC1aL98s0quBrc8My0/cK8ByAYv3NgPJi/ll15EiMpsEvKJMHhuXq2\n5R88VJtQBLZvT8MIHEF5JB2qDwKBgQDJLoLHEh4yEyjNTo3GlRbPqoQurzPRpBnK\njh9/i45rwkzMhMcyAoi3Xv0R7KR+bTps0pj2relj0rdPwddROGkRAJoseSJVHAc/\njNX9TQLxWsC7UuMW2owpAwLxJIAWJ+tmFQBf1HmSkkFd5NMvCyr1NnDNH1EQ6e9r\nEZ3WjuG5MQKBgQCN3hG+dvrOTsa0CJ1QX2exMFi9c6z725+aiBxYifzvkFNV/Sui\nHCHI/E7mkP3jzDY1Cwi2sNsHICpmf8pkAtbotWJb0Mo0GFLipg+S7HM14qhqaW2f\nQsoIsSBS8HqBQhnhkHMZgzhb3EqlK+j1/8CGUcSHf6v5FIpYvyE1RzBIpwKBgCA0\nZNTvLow/iumKqKFgXl1x42UBwN7PUR2esKYfNfZEDT00CBsWUsJf300OP6rJW2/u\nKnRalKDZK2UGF6y1xgPlv8hcv8U2Dmb66Yp52H3AVFfoRdfztjoedEsb17E0RLd7\npyqv/aIb7YDVT4UZWZAVXetIFxcJC71s/YJKLxIRAoGAfZ/PyWOtyq5/WanBltzR\nLYSyuIfT0zSS5l4nY/s4HSxJBumaiu+AIikAAR1mK3ld8qGV62a0omaqWn79lu2c\neK93fZ9+3O6l3qa96X90e1mJ30/gIaSiLW97wq1iMTKkDhyfWSb/NVDfvnSqaIVA\n3xS4H6a3ornjVXYJNTcSI+E=',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_SHARE_DESC','汇聚全球顶尖大模型，为您提供智能问答服务',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_SHARE_IMG','',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_SHARE_LINK','',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('WECHAT_SHARE_TITLE','AI 智能助手',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50'),('welcome_message','欢迎使用 AI 智能助手！',NULL,'2026-04-29 06:04:50','2026-04-29 06:04:50');
/*!40000 ALTER TABLE `system_configs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `token_usage_records`
--

DROP TABLE IF EXISTS `token_usage_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_usage_records` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `amount` int NOT NULL,
  `type` varchar(255) NOT NULL,
  `model` varchar(255) DEFAULT NULL,
  `balanceAfter` int NOT NULL,
  `meta` text,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`userId`),
  KEY `idx_created_at` (`createdAt`),
  KEY `idx_token_usage_user_type_created` (`userId`,`type`,`createdAt`),
  KEY `idx_token_usage_type_model_created` (`type`,`model`,`createdAt`),
  CONSTRAINT `token_usage_records_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `token_usage_records`
--

LOCK TABLES `token_usage_records` WRITE;
/*!40000 ALTER TABLE `token_usage_records` DISABLE KEYS */;
INSERT INTO `token_usage_records` VALUES ('0052357c-e85d-48a6-bc4a-1cfe2124c26c','da71aea3-42c9-11f1-8855-4e5536d0b405',23,'chat','deepseek-v3',53,'{\"inputLen\":887,\"outputLen\":15,\"prompt_tokens\":307,\"completion_tokens\":139,\"usage_source\":\"provider\",\"total_cost\":23,\"conversationId\":\"928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9\"}','2026-04-28 06:23:38','2026-04-28 06:23:38'),('46e9286a-abb2-42ae-8f5c-b7215533a6c6','da71aea3-42c9-11f1-8855-4e5536d0b405',12,'chat','glm-4',44,'{\"inputLen\":847,\"outputLen\":29,\"prompt_tokens\":215,\"completion_tokens\":8,\"usage_source\":\"provider\",\"total_cost\":12,\"conversationId\":\"928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9\"}','2026-04-28 06:23:15','2026-04-28 06:23:15'),('739f0a3c-1856-4ec7-ad89-c6faf043fe8a','da71aea3-42c9-11f1-8855-4e5536d0b405',12,'chat','qwen-turbo',22,'{\"inputLen\":881,\"outputLen\":25,\"prompt_tokens\":224,\"completion_tokens\":7,\"usage_source\":\"provider\",\"total_cost\":12,\"conversationId\":\"928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9\"}','2026-04-28 06:23:14','2026-04-28 06:23:14'),('88b9997e-15fc-4df4-867b-653bede1990a','da71aea3-42c9-11f1-8855-4e5536d0b405',31,'chat','glm-4',5,'{\"inputLen\":878,\"outputLen\":26,\"prompt_tokens\":351,\"completion_tokens\":252,\"usage_source\":\"provider\",\"total_cost\":31,\"conversationId\":\"928c7ba5-9b62-41d6-bc75-bc0b18a1b9d9\"}','2026-04-28 06:28:27','2026-04-28 06:28:27');
/*!40000 ALTER TABLE `token_usage_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `email` varchar(255) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('user','admin','super_admin','ops','finance','support') NOT NULL DEFAULT 'user',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `membershipLevel` enum('free','pro','premium') NOT NULL DEFAULT 'free',
  `membershipExpireAt` datetime DEFAULT NULL,
  `tokensBalance` int NOT NULL DEFAULT '100',
  `multiModelUsageCount` int NOT NULL DEFAULT '0',
  `referralCode` varchar(255) DEFAULT NULL,
  `referredBy` varchar(255) DEFAULT NULL,
  `wechatOpenId` varchar(255) DEFAULT NULL,
  `wechatUnionId` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `referralCode` (`referralCode`),
  UNIQUE KEY `wechatOpenId` (`wechatOpenId`),
  UNIQUE KEY `wechatUnionId` (`wechatUnionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('da71aea3-42c9-11f1-8855-4e5536d0b405','admin@example.com','$2b$10$yX1UBksUvskpkt52x8aJne6PnI2JSY.OPkIiTtOYgYOUz7JLKX7qy','Admin User','super_admin',1,'free',NULL,22,0,NULL,NULL,NULL,NULL,NULL,'2026-04-28 06:16:54','2026-04-28 06:29:05');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `visit_logs`
--

DROP TABLE IF EXISTS `visit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `visit_logs` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `visitorId` varchar(128) NOT NULL,
  `isGuest` tinyint(1) NOT NULL DEFAULT '1',
  `path` varchar(255) NOT NULL,
  `source` varchar(64) NOT NULL DEFAULT 'web',
  `ip` varchar(64) DEFAULT NULL,
  `userAgent` varchar(512) DEFAULT NULL,
  `referer` varchar(512) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_visit_logs_created_at` (`createdAt`),
  KEY `idx_visit_logs_user_id_created_at` (`userId`,`createdAt`),
  KEY `idx_visit_logs_visitor_id_created_at` (`visitorId`,`createdAt`),
  KEY `idx_visit_logs_is_guest_created_at` (`isGuest`,`createdAt`),
  KEY `idx_visit_logs_visitor_path_created` (`visitorId`,`path`,`createdAt`),
  CONSTRAINT `visit_logs_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `visit_logs`
--

LOCK TABLES `visit_logs` WRITE;
/*!40000 ALTER TABLE `visit_logs` DISABLE KEYS */;
INSERT INTO `visit_logs` VALUES ('187f3982-1039-49b3-acb3-c17efcf02e57','da71aea3-42c9-11f1-8855-4e5536d0b405','52ab8cbe-1182-4258-9698-6f1afb609a41',0,'/','web','172.18.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-29 06:12:04','2026-04-29 06:12:04'),('63142cae-cb64-48f7-a669-425916f80957',NULL,'e74f6632-7510-480b-b064-a700feea1008',1,'/','web','172.18.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-29 11:00:58','2026-04-29 11:00:58'),('6abe3834-0d27-461a-b4b1-58bfcafb3b62',NULL,'52ab8cbe-1182-4258-9698-6f1afb609a41',1,'/','web','172.18.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-29 11:13:50','2026-04-29 11:13:50'),('934f2fad-0c79-4e61-8b0a-ee4857388f11',NULL,'52ab8cbe-1182-4258-9698-6f1afb609a41',1,'/','web','192.168.65.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-29 11:34:36','2026-04-29 11:34:36'),('be1c529e-bcd1-4277-a5bf-29085a36df39',NULL,'e74f6632-7510-480b-b064-a700feea1008',1,'/','web','172.18.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-28 07:31:59','2026-04-28 07:31:59'),('cb534508-67f3-46a6-b562-2dc0bbafb7c1',NULL,'e74f6632-7510-480b-b064-a700feea1008',1,'/','web','172.18.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-28 07:32:06','2026-04-28 07:32:06'),('d4e2f9d0-642e-4fd6-979e-74ca578b00a8',NULL,'52ab8cbe-1182-4258-9698-6f1afb609a41',1,'/','web','172.18.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-29 11:12:41','2026-04-29 11:12:41'),('e886f291-ba1b-4703-9262-e63a4b48e524',NULL,'52ab8cbe-1182-4258-9698-6f1afb609a41',1,'/','web','192.168.65.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',NULL,'2026-04-29 11:18:26','2026-04-29 11:18:26');
/*!40000 ALTER TABLE `visit_logs` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-30  2:25:19
