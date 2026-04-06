-- RankYatra Questions Seed Data
-- Run with: psql postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb -f questions.sql

INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_index) VALUES

-- Exam 1: SSC CGL Tier-I Mock Test
(1, 'Which article of the Indian Constitution abolishes untouchability?', 'Article 14', 'Article 17', 'Article 21', 'Article 25', 'B', 1),
(1, 'If PAPER is coded as SCTGX, how is PENCIL coded?', 'SGPFLO', 'SHQFLO', 'SGQFLO', 'SHPFLO', 'C', 2),
(1, 'A train 150m long passes a pole in 15 seconds. What is the speed of the train?', '8 m/s', '10 m/s', '12 m/s', '15 m/s', 'B', 3),
(1, 'Who is the author of "Discovery of India"?', 'Mahatma Gandhi', 'Jawaharlal Nehru', 'Subhas Chandra Bose', 'Bal Gangadhar Tilak', 'B', 4),
(1, 'The chemical formula of baking soda is:', 'Na2CO3', 'NaHCO3', 'NaOH', 'NaCl', 'B', 5),
(1, 'In a class, the ratio of boys to girls is 3:2. If there are 30 boys, how many girls are there?', '15', '18', '20', '25', 'C', 6),
(1, 'Which planet is known as the Red Planet?', 'Jupiter', 'Saturn', 'Mars', 'Venus', 'C', 7),
(1, 'The Headquarters of ISRO is located in:', 'Mumbai', 'Hyderabad', 'Bengaluru', 'Chennai', 'C', 8),
(1, 'Find the odd one out: 3, 5, 7, 9, 11', '3', '9', '5', '11', 'B', 9),
(1, 'Who invented the telephone?', 'Thomas Edison', 'Alexander Graham Bell', 'Nikola Tesla', 'James Watt', 'B', 10),

-- Exam 2: UPSC Prelims Mock Test
(2, 'Which Schedule of the Constitution deals with the recognition of languages?', '6th Schedule', '7th Schedule', '8th Schedule', '9th Schedule', 'C', 1),
(2, 'The Directive Principles of State Policy are contained in which Part of the Constitution?', 'Part III', 'Part IV', 'Part V', 'Part VI', 'B', 2),
(2, 'Which river is known as the Sorrow of Bihar?', 'Ganga', 'Son', 'Kosi', 'Gandak', 'C', 3),
(2, 'The term "Laissez-faire" is associated with which economic theory?', 'Socialism', 'Capitalism', 'Communism', 'Mixed Economy', 'B', 4),
(2, 'Who was the first Indian to go to space?', 'Kalpana Chawla', 'Rakesh Sharma', 'Sunita Williams', 'Ravish Malhotra', 'B', 5),
(2, 'Which movement was launched by Mahatma Gandhi in 1942?', 'Non-Cooperation Movement', 'Civil Disobedience Movement', 'Quit India Movement', 'Champaran Movement', 'C', 6),
(2, 'The Planning Commission of India was replaced by which body?', 'Finance Commission', 'NITI Aayog', 'Economic Advisory Council', 'National Development Council', 'B', 7),
(2, 'Which article of the Indian Constitution provides for freedom of speech and expression?', 'Article 14', 'Article 19', 'Article 21', 'Article 32', 'B', 8),
(2, 'The Constituent Assembly adopted the Indian Constitution on:', 'January 26, 1950', 'August 15, 1947', 'November 26, 1949', 'December 9, 1946', 'C', 9),
(2, 'Which is the longest river in India?', 'Yamuna', 'Ganga', 'Godavari', 'Krishna', 'B', 10),

-- Exam 3: Banking Awareness Test
(3, 'The Reserve Bank of India was established in which year?', '1930', '1935', '1947', '1949', 'B', 1),
(3, 'What does RTGS stand for?', 'Real Time Gross Settlement', 'Real Time General Settlement', 'Rapid Transfer Gross Settlement', 'Real Transfer Gross Settlement', 'A', 2),
(3, 'Which bank is known as the "Banker''s Bank" in India?', 'SBI', 'RBI', 'NABARD', 'SIDBI', 'B', 3),
(3, 'What is the full form of IFSC?', 'Indian Financial System Code', 'Indian Fund System Code', 'International Financial System Code', 'Indian Financial Service Code', 'A', 4),
(3, 'The Monetary Policy Committee (MPC) is headed by:', 'Finance Minister', 'Deputy Governor of RBI', 'Governor of RBI', 'Prime Minister', 'C', 5),
(3, 'CRR stands for:', 'Credit Reserve Ratio', 'Cash Reserve Ratio', 'Capital Reserve Ratio', 'Current Reserve Ratio', 'B', 6),
(3, 'Which is the largest public sector bank in India?', 'Punjab National Bank', 'Bank of Baroda', 'State Bank of India', 'Canara Bank', 'C', 7),
(3, 'NEFT transactions are settled in:', 'Real time', 'Hourly batches', 'Daily batches', 'Half-hourly batches', 'D', 8),
(3, 'The headquarters of World Bank is in:', 'New York', 'London', 'Washington D.C.', 'Geneva', 'C', 9),
(3, 'Which bank launched the first ATM in India?', 'HDFC Bank', 'ICICI Bank', 'Hongkong and Shanghai Banking Corporation (HSBC)', 'Citibank', 'C', 10),

-- Exam 4: UPSC Civil Services Prelims 2026
(4, 'Which Fundamental Right is called the "Heart and Soul" of the Constitution by Dr. B.R. Ambedkar?', 'Right to Equality', 'Right to Freedom', 'Right to Constitutional Remedies', 'Right Against Exploitation', 'C', 1),
(4, 'The concept of "Basic Structure" of the Constitution was propounded in which case?', 'Golaknath case', 'Maneka Gandhi case', 'Kesavananda Bharati case', 'Minerva Mills case', 'C', 2),
(4, 'Which Indian state has the longest coastline?', 'Tamil Nadu', 'Maharashtra', 'Gujarat', 'Andhra Pradesh', 'C', 3),
(4, 'The Green Revolution in India was introduced in which decade?', '1950s', '1960s', '1970s', '1980s', 'B', 4),
(4, 'Who is the constitutional head of India?', 'Prime Minister', 'Chief Justice of India', 'President', 'Vice President', 'C', 5),
(4, 'India''s first satellite was named:', 'Aryabhata', 'Bhaskara', 'Rohini', 'INSAT-1', 'A', 6),
(4, 'The Preamble of the Indian Constitution was amended in which year?', '1952', '1962', '1976', '1984', 'C', 7),
(4, 'Who among the following is known as the "Iron Man of India"?', 'Jawaharlal Nehru', 'Sardar Vallabhbhai Patel', 'Subhas Chandra Bose', 'Bhagat Singh', 'B', 8),
(4, 'The National Human Rights Commission was established in the year:', '1991', '1993', '1995', '1997', 'B', 9),
(4, 'Which gas is responsible for global warming?', 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen', 'C', 10),

-- Exam 5: IBPS PO Reasoning & Aptitude
(5, 'If A is the brother of B, B is the sister of C, C is the father of D, what is D to A?', 'Nephew/Niece', 'Son/Daughter', 'Cousin', 'Cannot be determined', 'D', 1),
(5, 'A man walks 5 km North, then 3 km East, then 5 km South. How far is he from the starting point?', '3 km', '5 km', '8 km', '13 km', 'A', 2),
(5, 'In the series 2, 6, 18, 54, ____, what is the next term?', '108', '144', '162', '216', 'C', 3),
(5, 'If all roses are flowers and some flowers are red, then:', 'All roses are red', 'Some roses are red', 'No roses are red', 'None of these', 'D', 4),
(5, 'A shopkeeper marks his goods 25% above cost price and gives 10% discount. His profit percent is:', '10.5%', '12.5%', '15%', '17.5%', 'B', 5),
(5, 'The average of first 50 natural numbers is:', '25', '25.5', '26', '27.5', 'B', 6),
(5, 'Pointing to a photograph, a man says "She is the daughter of my grandfather''s only son." How is the woman related to the man?', 'Sister', 'Daughter', 'Niece', 'Mother', 'A', 7),
(5, 'A pipe can fill a tank in 6 hours, another pipe can fill it in 12 hours. How long will they take together?', '3 hours', '4 hours', '5 hours', '6 hours', 'B', 8),
(5, 'Which of the following is not a prime number?', '31', '37', '41', '49', 'D', 9),
(5, 'In 20 years, A will be twice as old as B was 10 years ago. If A is now 9 years older than B, what is B''s current age?', '29', '39', '49', '59', 'B', 10),

-- Exam 6: RRB NTPC General Awareness
(6, 'Which is the largest railway zone in India?', 'Northern Railway', 'Southern Railway', 'Western Railway', 'Central Railway', 'A', 1),
(6, 'Indian Railways was nationalized in which year?', '1947', '1950', '1951', '1953', 'D', 2),
(6, 'Which is the longest railway platform in India?', 'Gorakhpur', 'Kharagpur', 'Kollam', 'Patna', 'A', 3),
(6, 'The headquarters of Central Railway is located in:', 'Mumbai CST', 'New Delhi', 'Kolkata', 'Chennai', 'A', 4),
(6, 'Vande Bharat Express is a/an:', 'Diesel engine train', 'Semi-high speed electric train', 'Maglev train', 'Bullet train', 'B', 5),
(6, 'Which train connects Kanyakumari to Dibrugarh?', 'Vivek Express', 'Rajdhani Express', 'Duronto Express', 'Humsafar Express', 'A', 6),
(6, 'The Railway Budget was merged with the General Budget in the year:', '2015', '2016', '2017', '2018', 'C', 7),
(6, 'Project UDAY is related to which sector?', 'Education', 'Healthcare', 'Railways', 'Agriculture', 'C', 8),
(6, 'KAVACH is an automatic train protection system designed to prevent:', 'Derailments', 'Signal failures', 'Collisions', 'Power failures', 'C', 9),
(6, 'Which Indian city is known as the "City of Railways"?', 'Mumbai', 'Kolkata', 'Jabalpur', 'Gorakhpur', 'C', 10),

-- Exam 7: SSC CHSL General Studies
(7, 'Who wrote the National Anthem of India?', 'Bankim Chandra Chattopadhyay', 'Rabindranath Tagore', 'Sarojini Naidu', 'Subramanya Bharati', 'B', 1),
(7, 'The Battle of Plassey was fought in which year?', '1757', '1761', '1764', '1776', 'A', 2),
(7, 'Which element has the atomic number 79?', 'Silver', 'Platinum', 'Gold', 'Copper', 'C', 3),
(7, 'The capital of Australia is:', 'Sydney', 'Melbourne', 'Canberra', 'Brisbane', 'C', 4),
(7, 'Photosynthesis takes place in which part of a plant cell?', 'Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome', 'C', 5),
(7, 'Which is the smallest planet in our Solar System?', 'Mars', 'Mercury', 'Venus', 'Pluto', 'B', 6),
(7, 'Who invented the World Wide Web?', 'Bill Gates', 'Steve Jobs', 'Tim Berners-Lee', 'Vint Cerf', 'C', 7),
(7, 'The Hirakud Dam is built on which river?', 'Godavari', 'Mahanadi', 'Krishna', 'Narmada', 'B', 8),
(7, 'Which vitamin is produced when human skin is exposed to sunlight?', 'Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D', 'D', 9),
(7, 'The largest ocean in the world is:', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean', 'D', 10),

-- Exam 8: SBI Clerk Prelims Mock
(8, 'The base rate system in banks replaced the:', 'PLR system', 'BPLR system', 'MCLR system', 'Repo rate system', 'B', 1),
(8, 'NPA stands for:', 'Net Performing Asset', 'Non-Performing Asset', 'Net Principal Amount', 'National Payment Authority', 'B', 2),
(8, 'Which of the following is NOT a function of RBI?', 'Issuing currency notes', 'Acting as banker to government', 'Providing loans to public directly', 'Controlling credit', 'C', 3),
(8, 'MUDRA stands for:', 'Micro Units Development and Refinance Agency', 'Multi Unit Development Refinance Association', 'Micro Urban Development Refinance Agency', 'Micro Unit Debt Relief Agency', 'A', 4),
(8, 'The minimum balance required in a Jan Dhan account is:', 'Rs. 500', 'Rs. 1000', 'Zero', 'Rs. 100', 'C', 5),
(8, 'Which of the following is a credit rating agency in India?', 'NSE', 'BSE', 'CRISIL', 'SEBI', 'C', 6),
(8, 'The SBI was established in the year:', '1947', '1955', '1969', '1980', 'B', 7),
(8, 'Cheque truncation means:', 'Physical movement of cheque', 'Electronic processing without physical movement', 'Cancellation of cheque', 'Post-dating of cheque', 'B', 8),
(8, 'Which is the highest denomination note issued by RBI?', 'Rs. 500', 'Rs. 1000', 'Rs. 2000', 'Rs. 5000', 'C', 9),
(8, 'The term "Core Banking Solution" (CBS) refers to:', 'Central banking', 'Computerized banking with networked branches', 'Government banking', 'Rural banking', 'B', 10),

-- Exam 9: Indian Army GD Agniveer
(9, 'The Agniveer scheme is related to which sector?', 'Agriculture', 'Defence', 'Education', 'Health', 'B', 1),
(9, 'Who is the Supreme Commander of the Indian Armed Forces?', 'Chief of Defence Staff', 'Prime Minister', 'President of India', 'Defence Minister', 'C', 2),
(9, 'The Indian Army was founded in the year:', '1895', '1947', '1776', '1858', 'A', 3),
(9, 'Which is the highest gallantry award in India?', 'Vir Chakra', 'Maha Vir Chakra', 'Param Vir Chakra', 'Ashok Chakra', 'C', 4),
(9, 'Operation Vijay was related to liberation of:', 'Goa', 'Kargil', 'Siachen', 'Bangladesh', 'B', 5),
(9, 'The motto of the Indian Army is:', 'Service Before Self', 'Touch the Sky with Glory', 'Seva Parmo Dharma', 'Sarvada Shaktishali', 'C', 6),
(9, 'Which state has the maximum number of military personnel?', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Himachal Pradesh', 'C', 7),
(9, 'If a soldier walks at 6 km/h and cycles at 18 km/h, how long will it take to travel 54 km by cycle?', '2 hours', '3 hours', '4 hours', '5 hours', 'B', 8),
(9, 'The Siachen Glacier is located in which state/UT?', 'Himachal Pradesh', 'Uttarakhand', 'Ladakh', 'Arunachal Pradesh', 'C', 9),
(9, 'INS Vikrant is the name of India''s:', 'Nuclear submarine', 'Aircraft carrier', 'Destroyer', 'Frigate', 'B', 10),

-- Exam 10: NDA & NA Mathematics Mock
(10, 'What is the value of sin 30° + cos 60°?', '0', '0.5', '1', '1.5', 'C', 1),
(10, 'The sum of interior angles of a hexagon is:', '540°', '720°', '900°', '1080°', 'B', 2),
(10, 'If the radius of a circle is doubled, its area becomes:', 'Double', 'Triple', 'Four times', 'Eight times', 'C', 3),
(10, 'What is the HCF of 36 and 48?', '6', '8', '12', '18', 'C', 4),
(10, 'The value of log₁₀(1000) is:', '2', '3', '4', '10', 'B', 5),
(10, 'In a right-angled triangle, if the two legs are 3 and 4, the hypotenuse is:', '5', '6', '7', '8', 'A', 6),
(10, 'If 2x + 5 = 15, then x equals:', '3', '4', '5', '6', 'C', 7),
(10, 'The probability of getting a head when a fair coin is tossed is:', '0', '0.25', '0.5', '1', 'C', 8),
(10, 'What is 15% of 200?', '20', '25', '30', '35', 'C', 9),
(10, 'The area of a triangle with base 10 cm and height 8 cm is:', '40 cm²', '45 cm²', '80 cm²', '20 cm²', 'A', 10),

-- Exam 11: NEET Biology Practice Test
(11, 'The powerhouse of the cell is:', 'Nucleus', 'Ribosome', 'Mitochondria', 'Chloroplast', 'C', 1),
(11, 'DNA replication is:', 'Conservative', 'Semi-conservative', 'Non-conservative', 'Dispersive', 'B', 2),
(11, 'Which blood group is universal donor?', 'A', 'B', 'AB', 'O', 'D', 3),
(11, 'Insulin is secreted by which part of the pancreas?', 'Alpha cells', 'Beta cells', 'Delta cells', 'Acinar cells', 'B', 4),
(11, 'The process by which plants lose water through leaves is called:', 'Transpiration', 'Respiration', 'Evaporation', 'Photosynthesis', 'A', 5),
(11, 'Which vitamin is essential for blood clotting?', 'Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K', 'D', 6),
(11, 'The structural and functional unit of kidney is:', 'Nephron', 'Neuron', 'Nodule', 'Villus', 'A', 7),
(11, 'Photosynthesis equation: 6CO₂ + 6H₂O → C₆H₁₂O₆ + ___', '6CO₂', '6O₂', '6H₂O', 'ATP', 'B', 8),
(11, 'Which hormone is responsible for the fight-or-flight response?', 'Insulin', 'Adrenaline', 'Thyroxine', 'Estrogen', 'B', 9),
(11, 'The number of chromosomes in human somatic cells is:', '23', '46', '48', '44', 'B', 10),

-- Exam 12: IIT JEE Physics Mock Battle
(12, 'Newton''s second law of motion states that Force equals:', 'mass × velocity', 'mass × acceleration', 'mass × distance', 'mass × speed', 'B', 1),
(12, 'The SI unit of electric charge is:', 'Ampere', 'Volt', 'Coulomb', 'Ohm', 'C', 2),
(12, 'The speed of light in vacuum is approximately:', '3 × 10⁶ m/s', '3 × 10⁸ m/s', '3 × 10¹⁰ m/s', '3 × 10¹² m/s', 'B', 3),
(12, 'Which principle states that the total energy of an isolated system remains constant?', 'Newton''s first law', 'Law of conservation of momentum', 'Law of conservation of energy', 'Archimedes'' principle', 'C', 4),
(12, 'The phenomenon of light bending around obstacles is called:', 'Reflection', 'Refraction', 'Diffraction', 'Dispersion', 'C', 5),
(12, 'A body is thrown vertically upward with velocity u. The maximum height reached is:', 'u²/g', 'u²/2g', '2u²/g', 'u/2g', 'B', 6),
(12, 'Ohm''s law states that V = IR. If R is doubled and V remains constant, current becomes:', 'Double', 'Half', 'Same', 'Four times', 'B', 7),
(12, 'The unit of frequency is:', 'Watt', 'Joule', 'Hertz', 'Newton', 'C', 8),
(12, 'In a magnetic field, the force on a moving charge is given by:', 'F = qE', 'F = qvB', 'F = qv/B', 'F = q/vB', 'B', 9),
(12, 'Boyle''s law states that at constant temperature, pressure and volume are:', 'Directly proportional', 'Inversely proportional', 'Equal', 'Independent', 'B', 10);

SELECT setval('questions_id_seq', (SELECT MAX(id) FROM questions));
